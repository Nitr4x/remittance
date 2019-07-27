'use strict';

const Killable = artifacts.require('Killable');
const truffleAssert = require('truffle-assertions');

contract('Killable', (accounts) => {
    const owner = accounts[0];
    
    let instance;

    beforeEach("Creating new contract", async () => {
        instance = await Killable.new({from: owner});
    });

    it('Should not be able to kill the contract when it is not paused', async () => {
        await truffleAssert.reverts(
            instance.kill({from: owner})
        );
    });

    it('Should be able to kill the contract', async () => {
        await instance.pauseContract({from: owner});

        const txObj = await instance.kill({from: owner});
        assert.strictEqual(txObj.logs.length, 1);
        assert.strictEqual(txObj.logs[0].event, "LogContractKilled");
        assert.strictEqual(txObj.logs[0].args[0], owner);
    });
});