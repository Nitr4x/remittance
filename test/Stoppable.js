'use strict';

const Stoppable = artifacts.require('Stoppable');
const truffleAssert = require('truffle-assertions');

contract('Stoppable', (accounts) => {
    const owner = accounts[0];
    const stranger = accounts[1];

    let instance;

    beforeEach("Creating new contract", async () => {
        instance = await Stoppable.new({from: owner});
    });

    it('Should not be able to resume a contract if it is already running', async () => {
        await truffleAssert.reverts(
            instance.resumeContract({from: owner})
        );                  
    });

    it('Should not be able to pause a contract if it is already paused', async () => {
        const txObj = await instance.pauseContract({from: owner});
        assert.strictEqual(txObj.logs.length, 1);
        assert.strictEqual(txObj.logs[0].event, "LogPausedContract");

        await truffleAssert.reverts(
            instance.pauseContract({from: owner}) 
        );
    });

    it('Should only be paused by the contract\'s owner', async () => {
        await truffleAssert.reverts(
            instance.pauseContract({from: stranger})
        );
    });

    it('Should only be resumed by the contract\'s owner', async () => {
        const txObj = await instance.pauseContract({from: owner});
        assert.strictEqual(txObj.logs.length, 1);
        assert.strictEqual(txObj.logs[0].event, "LogPausedContract");
        
        await truffleAssert.reverts(
            instance.resumeContract({from: stranger})
        );
    });

    it('Shoudl pause and resume the contract', () => {
        return instance.pauseContract({from: owner})
            .then(txObj => {
                assert.strictEqual(txObj.logs.length, 1);
                assert.strictEqual(txObj.logs[0].event, "LogPausedContract");
                
                return instance.resumeContract({from: owner});
            })
            .then(txObj => {
                assert.strictEqual(txObj.logs.length, 1);
                assert.strictEqual(txObj.logs[0].event, "LogResumeContract");
            });
    })
});