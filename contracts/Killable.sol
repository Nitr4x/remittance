pragma solidity 0.5.10;

import "./SafeMath.sol";
import "./Stoppable.sol";

contract Killable is Stoppable {
    using SafeMath for uint;
    
    bool public killed;
    
    event LogContractKilled(address indexed emitter);

    modifier _whenAlive {
        require(!killed);
        _;
    }
     
    constructor() public {
        killed = false;
    }
    
    function kill() _isNotRunning _whenAlive public returns(bool success) {
        emit LogContractKilled(msg.sender);

        killed = true;
        
        return true;
    }
}