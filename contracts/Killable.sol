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
    
    modifier _whenKillingProcessNotStarted {
        require(!_killingProcess.status, "Killing process is started");
        _;
    }
    
    function startKillingProcess() _onlyOwner public returns(bool success) {
        uint date = now.add(DELAY);
        
        emit LogKillingProcessStarted(msg.sender, date);
        
        _killingProcess = KillingCondition({killingDate: date, status: true});
        
        return true;
    }
    
    function isKillingProcessStarted() public view returns(bool) {
        return _killingProcess.status;
    }
    
    function isReadyToKill() public view returns(bool) {
        return now > _killingProcess.killingDate;
    }
}