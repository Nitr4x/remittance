pragma solidity 0.5.10;

import './Owned.sol';

contract Stoppable is Owned {
    
    bool private isRunning;
    
    event LogPausedContract(address indexed sender);
    event LogResumeContract(address indexed sender);
    
    modifier _onlyIfRunning {
        require(isRunning);
        _;
    }
    
    modifier _isNotRunning {
        require(!isRunning);
        _;
    }
    
    constructor() public {
        isRunning = true;
    }
    
    function pauseContract() public _onlyOwner _onlyIfRunning returns(bool success) {
        isRunning = false;
        
        emit LogPausedContract(msg.sender);
        
        return true;
    }
    
    function resumeContract() public _onlyOwner _isNotRunning returns(bool success) {        
        isRunning = true;
        
        emit LogResumeContract(msg.sender);
        
        return true;
    }
}