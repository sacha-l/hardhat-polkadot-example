// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address) external view returns (uint);
    function transfer(address to, uint) external returns (bool);
}

contract GuessTheNumberGameWithPot {
    // Owner & token variables
    address public owner;
    IERC20 public token;
    
    // Game variables
    uint public roundStart;
    uint8 public constant MAX = 20;
    uint public constant REWARD = 5 * 1e18; // match your token decimals
    uint public constant DURATION = 7 minutes;

    struct G { address who; uint8 num; }
    G[] public guesses;

    // Events
    event Guessed(address who, uint8 num);
    event RoundEnded(uint8 random, address winner);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyActive() {
        require(block.timestamp < roundStart + DURATION, "round over");
        _;
    }

    // Non-payable constructor to fix "deploy transact not payable" error
    constructor(address tokenAddr) {
        owner = msg.sender;
        token = IERC20(tokenAddr);
        roundStart = block.timestamp;
    }

    // Game functions
    function guess(uint8 n) external onlyActive {
        require(n <= MAX, "out of range");
        guesses.push(G(msg.sender, n));
        emit Guessed(msg.sender, n);
    }

    function endRound() external {
        require(block.timestamp >= roundStart + DURATION, "still active");

        if (guesses.length > 0) {
            uint8 rnd = uint8(
              uint256(keccak256(abi.encodePacked(
                block.timestamp, blockhash(block.number - 1)
              ))) % (MAX + 1)
            );

            // find closest
            uint best = type(uint).max;
            address winner = address(0);
            for (uint i = 0; i < guesses.length; i++) {
                uint diff = guesses[i].num > rnd
                           ? guesses[i].num - rnd
                           : rnd - guesses[i].num;
                if (diff < best) {
                    best = diff;
                    winner = guesses[i].who;
                }
            }
            
            // distribute reward directly
            token.transfer(winner, REWARD);
            emit RoundEnded(rnd, winner);
        }

        // reset
        delete guesses;
        roundStart = block.timestamp;
    }
    
    // Token management functions
    function withdraw(uint amount) external onlyOwner {
        token.transfer(owner, amount);
    }
}