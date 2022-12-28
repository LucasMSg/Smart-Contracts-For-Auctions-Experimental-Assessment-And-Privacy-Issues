var ethers = require('ethers');
var SEEDS = require('./seeds.js');

const MultipartySmartDiffieHellmanController = artifacts.require(
  'MultipartySmartDiffieHellmanController'
);
const MultipartySmartDiffieHellmanClient = artifacts.require(
  'MultipartySmartDiffieHellmanClient'
);

module.exports = {
  exec: async function exec(bidders) {
    console.log('SmartDiffieHellman protocol execution');

    //Diffie–Hellman key generation
    // Deploys MultipartySmartDiffieHellmanController
    var clients = [];
    const controller = await MultipartySmartDiffieHellmanController.new();
    let receipt = await web3.eth.getTransactionReceipt(
      controller.transactionHash
    );
    console.log(
      'gas used for controller deployment ' + receipt.gasUsed.toString()
    );

    for (let i = 0; i < bidders.length; i++) {
      //Deploy clients
      let client = await MultipartySmartDiffieHellmanClient.new(
        controller.address
      );
      let receipt = await web3.eth.getTransactionReceipt(
        client.transactionHash
      );
      console.log(
        'gas used for client ' + i + ' deployment ' + receipt.gasUsed.toString()
      );
      clients = [...clients, client];
    }

    //checking that they are different instances
    for (let i = 0; i < clients.length - 1; i++) {
      assert.ok(clients[i].address, 'Contract ' + i + ' has not been deployed');

      for (let j = i + 1; j < clients.length; j++)
        assert.notEqual(
          clients[i].address,
          clients[j].address,
          'Contract ' + i + ' and contract ' + j + ' should be different'
        );
    }

    // generating Aa's for clients
    var clientAas = [];
    for (let i = 0; i < bidders.length; i++) {
      let client = clients[i];

      clientAas.push(await client.generateA.call([SEEDS.SEEDS[i]]));

      assert.ok(clientAas[i]['_A'], 'Missing _A');
      assert.ok(clientAas[i]['_a'], 'Missing _a');
    }

    //sort clients
    let sortTx = await controller.sortClients();
    console.log(
      'gas used for controller sortClients ' + sortTx.receipt.gasUsed
    );

    let contractClients = [];

    for (let j = 0; j < clients.length; j++) {
      contractClients = [
        ...contractClients,
        (await controller.clients.call(j)).toLowerCase(),
      ];
    }

    let jsSort = [...contractClients];
    jsSort.sort();

    clients.sort((l, r) => {
      let lStr = parseInt((l + '').substr(2), 16);
      let rStr = parseInt((r + '').substr(2), 16);
      return l.address.toLowerCase().localeCompare(r.address.toLowerCase());
    });

    assert.equal(
      contractClients.length,
      bidders.length,
      'Sort did not work (wrong length)'
    );
    assert.deepEqual(contractClients, jsSort, 'Clients not correctly sorted');

    //request first keys
    let startTx = await controller.start();
    console.log('gas used for controller start ' + startTx.receipt.gasUsed);

    //start will make clients request their own keys, and will store 0 as their key

    for (let i = 0; i < bidders.length; i++) {
      let client = clients[i];

      assert.ok(
        await client.requested.call(0),
        'Client does not have any request'
      );

      let reqKeys = await client.requestedKeys.call();
      //	requestkeys is a view it doesn't do anything

      assert.ok(reqKeys['_clientsKeys'], 'Request has no _clientKeys');
      assert.ok(reqKeys['_keys'], 'Request has no _keys');

      assert.equal(
        reqKeys['_clientsKeys'].length,
        1,
        'Wrong number of _clientKeys'
      );
      assert.equal(reqKeys['_keys'].length, 1, 'Wrong number of _keys');
      //should be 1 because they onky requested their own
    }

    //compute all keys
    let found = false;

    do {
      for (let i = 0; i < bidders.length; i++) {
        let client = clients[i];
        found = (await client.getRequestedSize.call()) > 0;
        let requested = await client.requestedKeys.call();
        //is recalculating requested
        assert.equal(
          requested['_clientsKeys'].length,
          requested['_keys'].length,
          '_clientsKeys.length != _keys.length'
        );

        for (let j = 0; j < requested['_clientsKeys'].length; j++) {
          let clientsKey = requested['_clientsKeys'][j];
          let key = requested['_keys'][j];

          let answerKey =
            key == 0
              ? clientAas[i]['_A']
              : await client.generateAExtB.call(clientAas[i]['_a'], key);
          //if key=0 save A, else generateAExtB
          let answerTx = await client.answer(clientsKey, answerKey);
          console.log(
            'gas used for client ' + i + ' answer ' + answerTx.receipt.gasUsed
          );
        }
      }
    } while (found);

    // Calculate secret key
    let privateKeys = [];
    for (let i = 0; i < bidders.length; i++) {
      let client = clients[i];

      let finalKey = await client.getFinalKey.call(
        clients.map((c) => c.address)
      );

      privateKeys = [
        ...privateKeys,
        await client.generateAExtB.call(clientAas[i]['_a'], finalKey),
      ];
    }

    // Check if all keys are the same
    assert.equal(
      Object.keys(privateKeys).length,
      bidders.length,
      'Not all clients have a secret key'
    );
    for (let i = 0; i < bidders.length - 1; i++) {
      assert.equal(
        privateKeys[i] + '',
        privateKeys[i + 1] + '',
        'privateKeys[' + i + '] != privateKeys[' + (i + 1) + ']'
      );
    }
    console.log('Keys generated');
    return privateKeys;
  },
};
