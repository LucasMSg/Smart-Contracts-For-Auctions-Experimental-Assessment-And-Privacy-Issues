const SEEDS = require('./seeds.js');

const MultipartySmartDiffieHellmanController = artifacts.require(
  'MultipartySmartDiffieHellmanController'
);
const MultipartySmartDiffieHellmanClient = artifacts.require(
  'MultipartySmartDiffieHellmanClient'
);

module.exports = {
  exec: async function exec(participants) {
    console.log('SmartDiffieHellman protocol execution');

    //Diffie–Hellman key generation
    // Deploys MultipartySmartDiffieHellmanController
    let clients = [];
    const controller = await MultipartySmartDiffieHellmanController.new();
    const receipt = await web3.eth.getTransactionReceipt(
      controller.transactionHash
    );
    console.log(
      'gas used for controller deployment ' + receipt.gasUsed.toString()
    );

    for (let i = 0; i < participants.length; i++) {
      //Deploy clients
      const client = await MultipartySmartDiffieHellmanClient.new(
        controller.address
      );
      const receipt = await web3.eth.getTransactionReceipt(
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
    const clientAas = [];
    for (let i = 0; i < participants.length; i++) {
      const client = clients[i];

      clientAas.push(await client.generateA.call([SEEDS.SEEDS[i]]));

      assert.ok(clientAas[i]['_A'], 'Missing _A');
      assert.ok(clientAas[i]['_a'], 'Missing _a');
    }

    //request first keys
    const startTx = await controller.start();
    console.log('gas used for controller start ' + startTx.receipt.gasUsed);
    let contractClients = [];

    for (let j = 0; j < clients.length; j++) {
      contractClients = [
        ...contractClients,
        (await controller.clients.call(j)).toLowerCase(),
      ];
    }

    const jsSort = [...contractClients];
    jsSort.sort();

    clients.sort((l, r) => {
      return l.address.toLowerCase().localeCompare(r.address.toLowerCase());
    });

    assert.equal(
      contractClients.length,
      participants.length,
      'Sort did not work (wrong length)'
    );
    assert.deepEqual(contractClients, jsSort, 'Clients not correctly sorted');
    //start will make clients request their own keys, and will store 0 as their key

    for (let i = 0; i < participants.length; i++) {
      const client = clients[i];

      assert.ok(
        await client.requested.call(0),
        'Client does not have any request'
      );

      const reqKeys = await client.requestedKeys.call();
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
      for (let i = 0; i < participants.length; i++) {
        const client = clients[i];
        found = (await client.getRequestedSize.call()) > 0;
        const requested = await client.requestedKeys.call();
        //is recalculating requested
        assert.equal(
          requested['_clientsKeys'].length,
          requested['_keys'].length,
          '_clientsKeys.length != _keys.length'
        );

        for (let j = 0; j < requested['_clientsKeys'].length; j++) {
          const clientsKey = requested['_clientsKeys'][j];
          const key = requested['_keys'][j];

          const answerKey =
            key == 0
              ? clientAas[i]['_A']
              : await client.generateAExtB.call(clientAas[i]['_a'], key);
          //if key=0 save A, else generateAExtB
          const answerTx = await client.answer(clientsKey, answerKey);
          console.log(
            'gas used for client ' + i + ' answer ' + answerTx.receipt.gasUsed
          );
        }
      }
    } while (found);

    // Calculate secret key
    let privateKeys = [];
    for (let i = 0; i < participants.length; i++) {
      const client = clients[i];

      const finalKey = await client.getFinalKey.call(
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
      participants.length,
      'Not all clients have a secret key'
    );
    for (let i = 0; i < participants.length - 1; i++) {
      console.log(privateKeys[i].toString());
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

