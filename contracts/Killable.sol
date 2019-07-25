pragma solidity 0.5.10;

import "./SafeMath.sol";
import "./Owned.sol";

contract Killable is Owned {
    using SafeMath for uint;
    
    uint public constant DELAY = 30 days;
    
    struct KillCondition {
        uint killingDate;
        bool status;
    }
    
    KillCondition private _killProcess;

    event LogKillingProcessStarted(address emitter, uint deadline);
    
    modifier _whenKillingProcessNotStarted {
        require(!_killProcess.status, "Killing process is started");
        _;
    }
    
    function startKillingProcess() _onlyOwner public returns(bool success) {
        uint date = now.add(DELAY);
        
        emit LogKillingProcessStarted(msg.sender, date);
        
        _killProcess = KillCondition({killingDate: date, status: true});
        
        return true;
    }
    
    function isKillingProcessStarted() public view returns(bool) {
        return _killProcess.status;
    }
    
    function isReadyToKill() public view returns(bool) {
        return now > _killProcess.killingDate;
    }
}