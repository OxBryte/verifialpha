// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TrackRecord {
    event Decision(
        uint256 indexed id,
        address indexed agent,
        bytes32 storageRoot,
        int8 action,        // 1 = LONG, -1 = SHORT, 0 = FLAT
        uint64 ts
    );

    uint256 public count;
    mapping(uint256 => bytes32) public roots;

    function logDecision(bytes32 storageRoot, int8 action) external returns (uint256 id) {
        id = count++;
        roots[id] = storageRoot;
        emit Decision(id, msg.sender, storageRoot, action, uint64(block.timestamp));
    }
}
