'use strict';

const Owned = artifacts.require('Owned');
const truffleAssert = require('truffle-assertions');

contract('Owned', (accounts) => {
    const owner = accounts[0];
    const stranger = accounts[1];

    let instance;

    beforeEach("Creating new contract", async () => {
        instance = await Owned.new({from: owner});
    });

    it('Owner should be ' + owner, () => {
        return instance.getOwner({from: owner})
            .then(_owner => {
                assert.strictEqual(_owner, owner);
            });
    });

    it('Owner should be ' + stranger, () => {
        return instance.changeOwner(stranger, {from: owner})
            .then(() => {
                return instance.getOwner({from: owner});
            })
            .then(_owner => {
                assert.strictEqual(_owner, stranger);
            });
    });

    it('Should not authorized changing the owner from someone else than the owner', async () => {
        await truffleAssert.reverts(
            instance.changeOwner(stranger, {from: stranger})
        );               
    });
});