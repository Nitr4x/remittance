const Math = artifacts.require("./SafeMath");
const Remittance = artifacts.require("./Remittance");

module.exports = async function (deployer) {
    await deployer.deploy(Math);
    await deployer.link(Math, Remittance);
    await deployer.deploy(Remittance, true);
};
