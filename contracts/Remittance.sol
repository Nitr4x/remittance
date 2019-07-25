pragma solidity 0.5.10;

import "./SafeMath.sol";
import "./Stoppable.sol";

contract Remittance is Stoppable {
    using SafeMath for uint;
    
    struct Order {
        uint deadline;
        address emitter;
        uint amount;
    }
    
    uint constant TX_FEES = 2000;

    mapping(bytes32 => Order) public orders;
    mapping(address => uint) public fees;
    
    event LogNewOrderPlaced(address indexed emitter, uint amount, bytes32 hashedOTP);
    event LogFeesTaken(address indexed emitter, address owner, uint amount);
    event LogOrderCancelled(address indexed emitter, uint amount, bytes32 hashedOTP);
    event LogWithdrawn(address indexed emitter, bytes32 hashedOTP, uint amount);
    event LogFeesWithdrawn(address indexed emitter, uint amount);

    function hashOTP(address exchange, bytes32 password) public view returns(bytes32 hash) {
        require(exchange != address(0) && password != 0, "Both exchange and password must be set");
        hash = keccak256(abi.encodePacked(address(this), exchange, password));
    }
    
    function newOrder(bytes32 hashedOTP, uint delay) _onlyIfRunning public payable returns(bool success) {
        require(hashedOTP != 0 && msg.value > 0, "An error occured. Ensure that the secret is set and that your transaction value is above 0");
        require(delay > 0 days, "Delay should be above 0 day");
        require(orders[hashedOTP].emitter == address(0), "Password already used");
        
        uint amount = msg.value.sub(TX_FEES);
        address owner = getOwner();
        
        fees[owner] = fees[owner].add(TX_FEES);
        emit LogFeesTaken(msg.sender, owner, TX_FEES);
        
        emit LogNewOrderPlaced(msg.sender, amount, hashedOTP);
        orders[hashedOTP] = Order({
            deadline: now.add(delay),
            emitter: msg.sender,
            amount: amount
        });
        
        return true;
    }
    
    function cancelOrder(bytes32 hashedOTP) public returns(bool success) {
        Order memory tx = orders[hashedOTP];
        
        require(tx.amount > 0, "Neither the order does not exist or the password is wrong");
        require(now >= tx.deadline, "You must wait 5 days before cancelling the transaction");
        require(tx.emitter == msg.sender, "The call must be initiated by the emitter");
        
        delete(orders[hashedOTP]);
        
        emit LogOrderCancelled(msg.sender, tx.amount, hashedOTP);
        msg.sender.transfer(tx.amount);
        
        return true;
    }
    
    function withdraw(bytes32 password) public returns(bool success) {
        bytes32 hashedOTP = hashOTP(msg.sender, password);
        uint amount = orders[hashedOTP].amount;
        
        require(amount > 0, "Neither the order does not exist or the password is wrong");
        
        delete(orders[hashedOTP]);
        
        emit LogWithdrawn(msg.sender, hashedOTP, amount);
        msg.sender.transfer(amount);
        
        return true;
    }
    
    function withdrawFees() public returns(bool success) {
        uint amount = fees[msg.sender];
        
        require(amount > 0, "Nothing to withdraw");
        
        fees[msg.sender] = 0;
        
        emit LogFeesWithdrawn(msg.sender, amount);
        msg.sender.transfer(amount);
        
        return true;
    }
}