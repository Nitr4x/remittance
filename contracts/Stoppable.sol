pragma solidity 0.5.10;

import './Owned.sol';

contract Stoppable is Owned {
    
    bool isRunning;
    
    event LogPausedContract(address sender);
    event LogResumeContract(address sender);
    
    modifier _onlyIfRunning {
        require(isRunning);
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
    
    function resumeContract() public _onlyOwner returns(bool success) {
        require(!isRunning);
        
        isRunning = true;
        
        emit LogResumeContract(msg.sender);
        
        return true;
    }
}