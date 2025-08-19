// CommonJS export so it works in Node without type: module
module.exports = {
  claimAbi: [
    {
      type: 'function',
      name: 'claim',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'recipient', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'fid', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'signature', type: 'bytes' },
      ],
      outputs: [],
    },
    {
      type: 'function',
      name: 'used',
      stateMutability: 'view',
      inputs: [ { name: 'fid', type: 'uint256' }, { name: 'nonce', type: 'uint256' } ],
      outputs: [ { name: '', type: 'bool' } ],
    }
  ]
};


