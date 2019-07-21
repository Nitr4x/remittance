'use strict';

const Remittance = artifacts.require('Remittance');
const truffleAssert = require('truffle-assertions');

const {toWei} = web3.utils;
const BN = require('big-number');

contract('Remittance', (accounts) => {
    const owner = accounts[0];
    const exchange = accounts[1];
    const stranger = accounts[2];
    const nil = "0x0000000000000000000000000000000000000000";
    const password = web3.utils.utf8ToHex("123456");
    const fiveDays = 5 * 24 * 60 * 60;
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
        instance = await Remittance.new(true, {from: owner});
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

    describe('======= newOrder unit testing =======', () => {
        let hashedOTP;

        beforeEach('Creating hash', async () => {
            hashedOTP = await instance.hashOTP(exchange, password);
        });
    
        it('Should create a new transaction', async () => {
            const txObj = await instance.newOrder(hashedOTP, fiveDays, {from: stranger, value: toWei("0.1", "ether")});
            assert.strictEqual(txObj.logs.length, 2);
            assert.strictEqual(txObj.logs[0].event, "LogTakeFees");
            assert.strictEqual(txObj.logs[0].args[0], stranger);
            assert.strictEqual(txObj.logs[0].args[1].toString(), "2000");
    
            assert.strictEqual(txObj.logs[1].event, "LogNewOrder");
            assert.strictEqual(txObj.logs[1].args[0], stranger);
            assert.strictEqual(txObj.logs[1].args[1].toString(), new BN(toWei("0.1", "ether")).minus(2000).toString());
            
            const order = await instance.orders.call(hashedOTP);
            assert.strictEqual(order.amount.toString(), new BN(toWei("0.1", "ether")).minus(2000).toString())

            const fees = await instance.fees.call(owner);
            assert.strictEqual(fees.toString(), "2000");
        });

        it('Should fail if the hashOTP is invalid', async () => {
            await truffleAssert.reverts(
                instance.newOrder(web3.utils.utf8ToHex(""), fiveDays, {from: owner, value: toWei("0.1", "ether")})
            );          
        });

        it('Should fail if the tx value is equal to 0', async () => {
            await truffleAssert.reverts(
                instance.newOrder(password, fiveDays, {from: owner})
            );          
        });

        it('Should fail if the hashedOTP is already used', async () => {
            await instance.newOrder(hashedOTP, fiveDays, {from: owner, value: toWei("0.1", "ether")})
            await truffleAssert.reverts(
                instance.newOrder(hashedOTP, fiveDays, {from: owner, value: toWei("0.1", "ether")})
            );
        });
    })

    describe('======= cancelOrder unit testing =======', () => {
        let hashedOTP;

        beforeEach('Creating new order', async () => {
            hashedOTP = await instance.hashOTP(exchange, password);

            const txObj = await instance.newOrder(hashedOTP, fiveDays, {from: owner, value: toWei("0.1", "ether")});

            assert.strictEqual(txObj.logs.length, 2);
            assert.strictEqual(txObj.logs[0].event, "LogTakeFees");
            assert.strictEqual(txObj.logs[0].args[0], owner);
            assert.strictEqual(txObj.logs[0].args[1].toString(), "2000");
            assert.strictEqual(txObj.logs[1].event, "LogNewOrder");
            assert.strictEqual(txObj.logs[1].args[0], owner);
            assert.strictEqual(txObj.logs[1].args[1].toString(), new BN(toWei("0.1", "ether")).minus(2000).toString());
        });

        it('Should be able to cancel an order after one 1 day time', async () => {
            hashedOTP = await instance.hashOTP(owner, password);
            await instance.newOrder(hashedOTP, 1 * 24 * 60 * 60, {from: owner, value: toWei("0.1", "ether")});

            await increaseTime(1 * 24 * 60 * 60);
    
            let txObj = await instance.cancelOrder(hashedOTP, {from: owner});
            assert.strictEqual(txObj.logs.length, 1);
            assert.strictEqual(txObj.logs[0].event, "LogCancelOrder");
            assert.strictEqual(txObj.logs[0].args[0], owner);
            assert.strictEqual(txObj.logs[0].args[1].toString(), new BN(toWei("0.1", "ether")).minus(2000).toString());

            const order = instance.orders.call(hashedOTP);
            assert.strictEqual(order.emitter, undefined);
        });

        it('Should be able to cancel an order and create a new order with the same underlying hash', async () => {
            await increaseTime(fiveDays);
    
            let txObj = await instance.cancelOrder(hashedOTP, {from: owner});
            assert.strictEqual(txObj.logs.length, 1);
            assert.strictEqual(txObj.logs[0].event, "LogCancelOrder");
            assert.strictEqual(txObj.logs[0].args[0], owner);
            assert.strictEqual(txObj.logs[0].args[1].toString(), new BN(toWei("0.1", "ether")).minus(2000).toString());
    
            let order = instance.orders.call(hashedOTP);
            assert.strictEqual(order.emitter, undefined);

            txObj = await instance.newOrder(hashedOTP, fiveDays, {from: owner, value: toWei("0.1", "ether")});
            assert.strictEqual(txObj.logs.length, 2);
            assert.strictEqual(txObj.logs[1].event, "LogNewOrder");
            assert.strictEqual(txObj.logs[1].args[0], owner);
            assert.strictEqual(txObj.logs[1].args[1].toString(), new BN(toWei("0.1", "ether")).minus(2000).toString());

            order = await instance.orders.call(hashedOTP);
            assert.strictEqual(order.amount.toString(), new BN(toWei("0.1", "ether")).minus(2000).toString())

            const fees = await instance.fees.call(owner);
            assert.strictEqual(fees.toString(), "4000");
        });
    
        it('Should not be able to cancel an order if the sender is not the tx emitter', async () => {
            await increaseTime(fiveDays);
    
            await truffleAssert.reverts(
                instance.cancelOrder(hashedOTP, {from: stranger})
            ); 
        });
    
        it('Should not be able to cancel an order with invalid secret', async () => {
            await increaseTime(fiveDays);
    
            await truffleAssert.reverts(
                instance.cancelOrder(web3.utils.utf8ToHex(""), {from: stranger})
            );
        });
    
        it('Should not be able to cancel an order before the deadline', async () => {
            await truffleAssert.reverts(
                instance.cancelOrder(hashedOTP, {from: owner})
            );
        });
    });

    describe('======= withdraw unit testing =======', () => {
        let hashedOTP;

        beforeEach('Creating new order', async () => {
            hashedOTP = await instance.hashOTP(exchange, password);

            const txObj = await instance.newOrder(hashedOTP, fiveDays, {from: owner, value: toWei("0.1", "ether")});

            assert.strictEqual(txObj.logs.length, 2);
            assert.strictEqual(txObj.logs[0].event, "LogTakeFees");
            assert.strictEqual(txObj.logs[0].args[0], owner);
            assert.strictEqual(txObj.logs[0].args[1].toString(), "2000");
            assert.strictEqual(txObj.logs[1].event, "LogNewOrder");
            assert.strictEqual(txObj.logs[1].args[0], owner);
            assert.strictEqual(txObj.logs[1].args[1].toString(), new BN(toWei("0.1", "ether")).minus(2000).toString());
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

            const txObj = await instance.withdraw(password, {from: exchange });
            const gasPrice = (await web3.eth.getTransaction(txObj.tx)).gasPrice;

            assert.strictEqual(txObj.logs.length, 1);
            assert.strictEqual(txObj.logs[0].event, "LogWithdraw");
            assert.strictEqual(txObj.logs[0].args[0], exchange);
            assert.strictEqual(txObj.logs[0].args[1].toString(), new BN(toWei("0.1", "ether")).minus(2000).toString());

            initialBalance.minus(txObj.receipt.gasUsed * gasPrice);
            initialBalance.add(toWei("0.1", "ether"));
            initialBalance.minus(2000);

            assert.strictEqual(await web3.eth.getBalance(exchange), initialBalance.toString());

            const order = await instance.orders.call(hashedOTP);
            assert.strictEqual(order.amount.toString(), "0")
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

            await instance.newOrder(hashedOTP, fiveDays, {from: stranger, value: toWei("0.1", "ether")});
        });

        it('Should fail if there is nothing to withdraw', async () => {
            await  instance.withdrawFees({from: owner});
            await truffleAssert.reverts(
                instance.withdrawFees({from: owner})
            );
        });

        it('Should withdraw the owner fees', async () => {
            let initialBalance = new BN(await web3.eth.getBalance(owner));

            const txObj = await instance.withdrawFees({ from: owner });
            const gasPrice = (await web3.eth.getTransaction(txObj.tx)).gasPrice;

            assert.strictEqual(txObj.logs.length, 1);
            assert.strictEqual(txObj.logs[0].event, "LogWithdraw");
            assert.strictEqual(txObj.logs[0].args[0], owner);
            assert.strictEqual(txObj.logs[0].args[1].toString(), "2000");

            initialBalance.minus(txObj.receipt.gasUsed * gasPrice);
            initialBalance.add(2000);

            assert.strictEqual(await web3.eth.getBalance(owner), initialBalance.toString());

            const fees = await instance.fees.call(owner);
            assert.strictEqual(fees.toString(), "0");

        });

        it('Should allow various person to withdraw fees', async () => {
            let txObj = await instance.changeOwner(stranger, {from: owner});
            
            assert.strictEqual(txObj.logs.length, 1);
            assert.strictEqual(txObj.logs[0].event, "LogOwnerChanged");
            assert.strictEqual(txObj.logs[0].args[0], stranger);

            await instance.newOrder(await instance.hashOTP(exchange, web3.utils.utf8ToHex("haha")), fiveDays, {from: owner, value: toWei("0.1", "ether")});

            let initialBalance = new BN(await web3.eth.getBalance(owner));

            txObj = await instance.withdrawFees({ from: owner });
            let gasPrice = (await web3.eth.getTransaction(txObj.tx)).gasPrice;

            assert.strictEqual(txObj.logs.length, 1);
            assert.strictEqual(txObj.logs[0].event, "LogWithdraw");
            assert.strictEqual(txObj.logs[0].args[0], owner);
            assert.strictEqual(txObj.logs[0].args[1].toString(), "2000");

            initialBalance.minus(txObj.receipt.gasUsed * gasPrice);
            initialBalance.add(2000);

            assert.strictEqual(await web3.eth.getBalance(owner), initialBalance.toString());

            let fees = await instance.fees.call(owner);
            assert.strictEqual(fees.toString(), "0");

            initialBalance = new BN(await web3.eth.getBalance(stranger));

            txObj = await instance.withdrawFees({ from: stranger });
            gasPrice = (await web3.eth.getTransaction(txObj.tx)).gasPrice;

            assert.strictEqual(txObj.logs.length, 1);
            assert.strictEqual(txObj.logs[0].event, "LogWithdraw");
            assert.strictEqual(txObj.logs[0].args[0], stranger);
            assert.strictEqual(txObj.logs[0].args[1].toString(), "2000");

            initialBalance.minus(txObj.receipt.gasUsed * gasPrice);
            initialBalance.add(2000);

            assert.strictEqual(await web3.eth.getBalance(stranger), initialBalance.toString());

            fees = await instance.fees.call(stranger);
            assert.strictEqual(fees.toString(), "0");
        });
    });
})