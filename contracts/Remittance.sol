pragma solidity 0.5.10;

import "./SafeMath.sol";
import "./Stoppable.sol";

contract Remittance is Stoppable {
    using SafeMath for uint;
    
    struct Order {
        uint time;
        address emitter;
        uint amount;
    }
    
    uint constant TX_FEES = 2000;
    uint constant CANCELLATION_DELAY = 5 days;
    
    mapping(bytes32 => Order) private transactions;
    mapping(address => uint) private fees;
    
    event LogNewTransaction(address indexed emitter, address exchange, uint amount);
    event LogTakeFees(address indexed emitter, uint amount);
    event LogCancelTransaction(address indexed emitter, address exchange, uint amount);
    event LogWithdraw(address indexed emitter, uint amount);
    
    function hashOTP(address exchange, bytes32 password) public view returns(bytes32 hash) {
        require(exchange != address(0) && password != 0, "Both exchange and password must be set");
        hash = keccak256(abi.encodePacked(address(this), exchange, password));
    }
    
    function newTransaction(address exchange, bytes32 hashedOTP) _onlyIfRunning public payable returns(bool success) {
        require(exchange != address(0) && hashedOTP != 0 && msg.value > 0, "An error occured. Ensure that both exchange and the secret are set and that your transaction value is above 0");

        require(transactions[hashedOTP].emitter == address(0), "Password already used");
        
        uint amount = msg.value;
        if (getOwner() != msg.sender) {
            fees[getOwner()] = fees[getOwner()].add(TX_FEES);
            amount = amount.sub(TX_FEES);
            emit LogTakeFees(msg.sender, TX_FEES);
        }
        
        emit LogNewTransaction(msg.sender, exchange, amount);
        transactions[hashedOTP] = Order({
            time: now.add(CANCELLATION_DELAY),
            emitter: msg.sender,
            amount: amount
        });
        
        return true;
    }
    
    function cancelTransaction(address exchange, bytes32 hashedOTP) public returns(bool success) {
        require(hashedOTP != 0, "The secret is not set");
        
        Order memory tx = transactions[hashedOTP];
        
        require(tx.amount > 0, "Neither the transaction does not exist or the password is wrong");
        require(now >= tx.time, "You must wait 5 days before cancelling the transaction");
        require(tx.emitter == msg.sender, "The call must be initiated by the wanted exchange");
        
        transactions[hashedOTP].amount = 0;
        transactions[hashedOTP].time = 0;
        transactions[hashedOTP].emitter = address(0);
        
        emit LogCancelTransaction(msg.sender, exchange, tx.amount);
        msg.sender.transfer(tx.amount);
        
        return true;
    }
    
    function withdraw(bytes32 password) public returns(bool success) {
        bytes32 hash = hashOTP(msg.sender, password);
        uint amount = transactions[hash].amount;
        
        require(amount > 0, "Neither the transaction does not exist or the password is wrong");
        
        transactions[hash].amount = 0;
        transactions[hash].time = 0;
        transactions[hash].emitter = address(0);
        
        emit LogWithdraw(msg.sender, amount);
        msg.sender.transfer(amount);
        
        return true;
    }
    
    function withdrawFees() public _onlyOwner returns(bool success) {
        uint amount = fees[getOwner()];
        
        require(amount > 0, "Nothing to withdraw");
        
        fees[getOwner()] = 0;
        
        emit LogWithdraw(msg.sender, amount);
        msg.sender.transfer(amount);
        
        return true;
    }
}