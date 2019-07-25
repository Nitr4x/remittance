pragma solidity 0.5.10;

import "./SafeMath.sol";
import "./Owned.sol";

contract Killable is Owned {
    using SafeMath for uint;
    
    uint public constant DELAY = 30 days;
    
    struct KillingCondition {
        uint killingDate;
        bool status;
    }
    
    KillingCondition private _killingProcess;

    event LogKillingProcessStarted(address emitter, uint deadline);
    event LogKillingProcessStopped(address emitter);

    modifier _whenKillingProcessNotStarted {
        require(!_killingProcess.status, "Killing process is started");
        _;
    }
    
    function startKillingProcess() _onlyOwner public returns(bool success) {
        require(!_killingProcess.status, "Killing process already started");

        uint date = now.add(DELAY);
        
        emit LogKillingProcessStarted(msg.sender, date);
        
        _killingProcess = KillingCondition({killingDate: date, status: true});
        
        return true;
    }
    
    function stopKillingProcess() _onlyOwner public returns(bool success) {
        require(_killingProcess.status, "Killing process is not started yet");

        emit LogKillingProcessStopped(msg.sender); 

        _killingProcess.killingDate = 0;
        _killingProcess.status = false;

        return true;
    }

    function isKillingProcessStarted() public view returns(bool) {
        return _killingProcess.status;
    }
    
    function isReadyToKill() public view returns(bool) {
        return (_killingProcess.killingDate != 0 && now > _killingProcess.killingDate);
    }
}