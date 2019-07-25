'use strict';

const Killable = artifacts.require('Killable');
const truffleAssert = require('truffle-assertions');

contract('Killable', (accounts) => {
    const owner = accounts[0];
    const stranger = accounts[1];

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

    let instance;

    beforeEach("Creating new contract", async () => {
        instance = await Killable.new({from: owner});
    });

    it('Should be able to start the killing process', async () => {
        const txObj = await instance.startKillingProcess({from: owner});

        assert.strictEqual(txObj.logs.length, 1);
        assert.strictEqual(txObj.logs[0].event, "LogKillingProcessStarted");
        assert.strictEqual(txObj.logs[0].args[0], owner);
    });

    it('Should not be able to stop the killing process', async() => {
        await truffleAssert.reverts(
            instance.stopKillingProcess({from: owner})
        );
    });

    it('Should not be ready to kill', async () => {
        assert.isFalse(await instance.isReadyToKill({from: owner}));
    });

    it('The killing process should not have been started yet', async () => {
        assert.isFalse(await instance.isKillingProcessStarted({from: owner}));
    });

    it('Should not be able to start the killing process by somebody else than the owner', async () => {
        await truffleAssert.reverts(
            instance.startKillingProcess({from: stranger})
        );
    });

    it('The killing process should be started', async () => {
        await instance.startKillingProcess({from: owner});

        assert.isTrue(await instance.isKillingProcessStarted({from: owner}));
    });

    it('Should be ready to kill', async () => {
        await instance.startKillingProcess({from: owner});

        await increaseTime(60 * 60 * 24 * 31);

        assert.isTrue(await instance.isReadyToKill({from: owner}));
    });

    it('Should be able to stop the killing process', async () => {
        await instance.startKillingProcess({from: owner});

        const txObj = await instance.stopKillingProcess({from: owner});
        assert.strictEqual(txObj.logs.length, 1);
        assert.strictEqual(txObj.logs[0].event, "LogKillingProcessStopped");
        assert.strictEqual(txObj.logs[0].args[0], owner);
    });

    it('Should not be able to start the killing process two consecutive times', async () => {
        await instance.startKillingProcess({from: owner});

        await truffleAssert.reverts(
            instance.startKillingProcess({from: owner})
        );
    })

    it('Should not be able to stop the killing strange by somebody else than the owner', async () => {
        await instance.startKillingProcess({from: owner});

        await truffleAssert.reverts(
            instance.stopKillingProcess({from: stranger})
        );
    });
});