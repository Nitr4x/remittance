'use strict';

const Remittance = artifacts.require('Remittance');
const truffleAssert = require('truffle-assertions');

const {toWei, fromWei } = web3.utils;
const BN = require('big-number');

contract('Remittance', (accounts) => {
    const owner = accounts[0];
    const exchange = accounts[1];
    const stranger = accounts[2];
    const nil = "0x0000000000000000000000000000000000000000";
    const password = web3.utils.utf8ToHex("123456");
    let instance;

    const evmMethod = (method, params = []) => {
        return new Promise(function (resolve, reject) {
            const sendMethod = (web3.currentProvider.sendAsync) ? web3.currentProvider.sendAsync.bind(web3.currentProvider) : web3.currentProvider.send.bind(web3.currentProvider);
            sendMethod(
                {
                    jsonrpc: '2.0',
                    method,
                    params,
                    id: new Date().getSeconds()
                },
                (error, res) => {
                    if (error) {
                        return reject(error);
                    }
    
                    resolve(res.result);
                }
            );
        });
    };
    
    const increaseTime = async (amount) => {
        await evmMethod("evm_increaseTime", [Number(amount)]);
        await evmMethod("evm_mine");
    };

    beforeEach("Creating new contract", async () => {
        instance = await Remittance.new({from: owner});
    });

    describe('======= hashOTP unit testing =======', () => {
        it('Should fail if the password is not set', async () => {
            await truffleAssert.reverts(
                instance.hashOTP(exchange, web3.utils.utf8ToHex(""))
            );
        });

        it('Should fail if the exchange is not set', async () => {
            await truffleAssert.reverts(
                instance.hashOTP(nil, password)
            );
        });
    });

    describe('======= newTransaction unit testing =======', () => {
        let hashedOTP;

        beforeEach('Creating hash', async () => {
            hashedOTP = await instance.hashOTP(exchange, password);
        });
    
        it('Should create a new transaction', async () => {
            const txObj = await instance.newTransaction(exchange, hashedOTP, {from: stranger, value: toWei("0.1", "ether")});
            assert.strictEqual(txObj.logs.length, 2);
            assert.strictEqual(txObj.logs[0].event, "LogTakeFees");
            assert.strictEqual(txObj.logs[0].args[0], stranger);
            assert.strictEqual(txObj.logs[0].args[1].toString(), "2000");
    
            assert.strictEqual(txObj.logs[1].event, "LogNewTransaction");
            assert.strictEqual(txObj.logs[1].args[0], stranger);
            assert.strictEqual(txObj.logs[1].args[1], exchange);
            assert.strictEqual(txObj.logs[1].args[2].toString(), new BN(toWei("0.1", "ether")).minus(2000).toString());
        });
    
        it('Should fail if the address is invalid', async () => {
            await truffleAssert.reverts(
                instance.newTransaction(nil, hashedOTP, {from: owner, value: toWei("0.1", "ether")})
            );       
        });

        it('Should fail if the hashOTP is invalid', async () => {
            await truffleAssert.reverts(
                instance.newTransaction(exchange, web3.utils.utf8ToHex(""), {from: owner, value: toWei("0.1", "ether")})
            );          
        });

        it('Should fail if the tx value is equal to 0', async () => {
            await truffleAssert.reverts(
                instance.newTransaction(exchange, password, {from: owner})
            );          
        });

        it('Should fail if the hashedOTP is already used', async () => {
            await instance.newTransaction(exchange, hashedOTP, {from: owner, value: toWei("0.1", "ether")})
            await truffleAssert.reverts(
                instance.newTransaction(exchange, hashedOTP, {from: owner, value: toWei("0.1", "ether")})
            );
        });
    })

    describe('======= cancelTransaction unit testing =======', () => {
        let hashedOTP;

        beforeEach('Creating new transaction', async () => {
            hashedOTP = await instance.hashOTP(exchange, password);

            const txObj = await instance.newTransaction(exchange, hashedOTP, {from: owner, value: toWei("0.1", "ether")});

            assert.strictEqual(txObj.logs.length, 2);
            assert.strictEqual(txObj.logs[0].event, "LogTakeFees");
            assert.strictEqual(txObj.logs[0].args[0], owner);
            assert.strictEqual(txObj.logs[0].args[1].toString(), "2000");
            assert.strictEqual(txObj.logs[1].event, "LogNewTransaction");
            assert.strictEqual(txObj.logs[1].args[0], owner);
            assert.strictEqual(txObj.logs[1].args[1], exchange);
            assert.strictEqual(txObj.logs[1].args[2].toString(), new BN(toWei("0.1", "ether")).minus(2000).toString());
        });

        it('Should be able to cancel a transaction and create a new transaction with the same underlying hash', async () => {
            await increaseTime(5 * 24 * 60 * 60);
    
            let txObj = await instance.cancelTransaction(exchange, hashedOTP, {from: owner});
            assert.strictEqual(txObj.logs.length, 1);
            assert.strictEqual(txObj.logs[0].event, "LogCancelTransaction");
            assert.strictEqual(txObj.logs[0].args[0], owner);
            assert.strictEqual(txObj.logs[0].args[1], exchange);
            assert.strictEqual(txObj.logs[0].args[2].toString(), new BN(toWei("0.1", "ether")).minus(2000).toString());
    
            txObj = await instance.newTransaction(exchange, hashedOTP, {from: owner, value: toWei("0.1", "ether")});
            assert.strictEqual(txObj.logs.length, 2);
            assert.strictEqual(txObj.logs[1].event, "LogNewTransaction");
            assert.strictEqual(txObj.logs[1].args[0], owner);
            assert.strictEqual(txObj.logs[1].args[1], exchange);
            assert.strictEqual(txObj.logs[1].args[2].toString(), new BN(toWei("0.1", "ether")).minus(2000).toString());
        });
    
        it('Should not be able to cancel a transaction if the sender is not the tx emitter', async () => {
            await increaseTime(5 * 24 * 60 * 60);
    
            await truffleAssert.reverts(
                instance.cancelTransaction(exchange, hashedOTP, {from: stranger})
            ); 
        });
    
        it('Should not be able to cancel a transaction with invalid address & password', async () => {
            await increaseTime(5 * 24 * 60 * 60);
    
            await truffleAssert.reverts(
                instance.cancelTransaction(exchange, web3.utils.utf8ToHex(""), {from: stranger})
            );
        });
    
        it('Should not be able to cancel a transaction before the deadline', async () => {
            await truffleAssert.reverts(
                instance.cancelTransaction(exchange, hashedOTP, {from: owner})
            );
        });
    });

    describe('======= withdraw unit testing =======', () => {
        beforeEach('Creating new transaction', async () => {
            const hashedOTP = await instance.hashOTP(exchange, password);

            const txObj = await instance.newTransaction(exchange, hashedOTP, {from: owner, value: toWei("0.1", "ether")});

            assert.strictEqual(txObj.logs.length, 2);
            assert.strictEqual(txObj.logs[0].event, "LogTakeFees");
            assert.strictEqual(txObj.logs[0].args[0], owner);
            assert.strictEqual(txObj.logs[0].args[1].toString(), "2000");
            assert.strictEqual(txObj.logs[1].event, "LogNewTransaction");
            assert.strictEqual(txObj.logs[1].args[0], owner);
            assert.strictEqual(txObj.logs[1].args[1], exchange);
            assert.strictEqual(txObj.logs[1].args[2].toString(), new BN(toWei("0.1", "ether")).minus(2000).toString());
        });
        
        it('Should fail if the provided password is invalid', async () => {
            await truffleAssert.reverts(
                instance.withdraw(web3.utils.utf8ToHex("amIAwes0m3?"), {from: exchange})
            );
        });

        it('Should fail if the sender is not the stated exchange', async () => {
            await truffleAssert.reverts(
                instance.withdraw(password, {from: stranger})
            );
        });

        it('Should withdraw the exchange balance', async () => {
            let initialBalance = new BN(await web3.eth.getBalance(exchange));

            const txObj = await instance.withdraw(password, {
                from: exchange,
                gasPrice: 50
            });
            assert.strictEqual(txObj.logs.length, 1);
            assert.strictEqual(txObj.logs[0].event, "LogWithdraw");
            assert.strictEqual(txObj.logs[0].args[0], exchange);
            assert.strictEqual(txObj.logs[0].args[1].toString(), new BN(toWei("0.1", "ether")).minus(2000).toString());

            initialBalance.minus(txObj.receipt.gasUsed * 50);
            initialBalance.add(toWei("0.1", "ether"));
            initialBalance.minus(2000);

            assert.strictEqual(await web3.eth.getBalance(exchange), initialBalance.toString());
        });

        it('Should not be able to withdraw two times', async () => {
            await instance.withdraw(password, {from: exchange});
            await truffleAssert.reverts(
                instance.withdraw(password, {from: exchange})
            );
        });
    });

    describe('======= withdrawFees unit testing =======', () => {
        beforeEach('Creating new transaction', async () => {
            const hashedOTP = await instance.hashOTP(exchange, password);

            await instance.newTransaction(exchange, hashedOTP, {from: stranger, value: toWei("0.1", "ether")});
        });
        
        it('Should fail if the sender is not the owner', async () => {
            await truffleAssert.reverts(
                instance.withdrawFees({from: stranger})
            );
        });

        it('Should fail if there is nothing to withdraw', async () => {
            await  instance.withdrawFees({from: owner});
            await truffleAssert.reverts(
                instance.withdrawFees({from: owner})
            );
        });

        it('Should withdraw the exchange balance', async () => {
            let initialBalance = new BN(await web3.eth.getBalance(owner));

            const txObj = await instance.withdrawFees({
                from: owner,
                gasPrice: 50
            });
            assert.strictEqual(txObj.logs.length, 1);
            assert.strictEqual(txObj.logs[0].event, "LogWithdraw");
            assert.strictEqual(txObj.logs[0].args[0], owner);
            assert.strictEqual(txObj.logs[0].args[1].toString(), "2000");

            initialBalance.minus(txObj.receipt.gasUsed * 50);
            initialBalance.add(2000);

            assert.strictEqual(await web3.eth.getBalance(owner), initialBalance.toString());
        });
    });
})