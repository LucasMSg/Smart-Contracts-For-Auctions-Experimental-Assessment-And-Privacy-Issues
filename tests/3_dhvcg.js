var SmartDHX = require('./SmartDHX');
const ctrs = require('./ctrs.js');

const MultipartySmartDiffieHellmanController = artifacts.require(
  'MultipartySmartDiffieHellmanController'
);
const MultipartySmartDiffieHellmanClient = artifacts.require(
  'MultipartySmartDiffieHellmanClient'
);
const VCG = artifacts.require('VCGDH');

contract('VCG with Diffie–Hellman test', async (accounts) => {
  it('auction', async function () {
    const auctioneer = accounts[0];
    const bidders = [];
    for (let i = 0; i < accounts.length / 2; i++) {
      bidders.push(accounts[i]);
    }

    const privateKeys = await SmartDHX.exec(bidders);

    //tables
    const bids = [];
    const passwords = [];

    //generating random bids and passwords
    for (let i = 0; i < bidders.length; i++) {
      let randomstring = Math.random().toString(36).slice(-8);
      passwords.push(randomstring);
      let bid = Math.floor(Math.random() * 100 + 1);
      bids.push(bid);
    }

    console.log('bids ' + bids);
    console.log('passwords ' + passwords);

    //deploying contract
    const vcgContract = await VCG.new();
    let receipt = await web3.eth.getTransactionReceipt(
      vcgContract.transactionHash
    );
    console.log('gas used for deployment ' + receipt.gasUsed.toString());

    async function bid(i) {
      let amountOfGas = await vcgContract.calculateHash.estimateGas(
        bids[i],
        passwords[i],
        {
          from: accounts[i],
        }
      );

      console.log('gas estimation for calculateHash is ' + amountOfGas);

      let encrypted = await vcgContract.calculateHash(bids[i], passwords[i], {
        from: accounts[i],
      });
      let result1 = await vcgContract.bid(encrypted, {from: accounts[i]});
      console.log('bid ' + i + ' gas ' + result1.receipt.gasUsed);
    }

    async function revealBid(i) {
      let commited = bids[i].toString() + passwords[i];

      let amountOfGas = await vcgContract.encryptBid.estimateGas(
        commited,
        '0x' + privateKeys[i]
      );

      console.log('gas estimation for encryptBid is ' + amountOfGas);

      let encryptedbid = await vcgContract.encryptBid(
        commited,
        '0x' + privateKeys[i]
      );

      let result = await vcgContract.encryptedBidding(encryptedbid, {
        from: accounts[i],
      });
      console.log('reveal ' + i + ' gas ' + result.receipt.gasUsed);
    }

    async function openAuction() {
      const openResult = await vcgContract.openAuction(ctrs.ctrs, {
        from: auctioneer,
      });
      console.log('open auction gas ' + openResult.receipt.gasUsed);
    }

    async function stopCommit() {
      const stopCommitTx = await vcgContract.stopCommitPhase({
        from: auctioneer,
      });
      console.log('stop commit gas ' + stopCommitTx.receipt.gasUsed);
    }

    async function getReveledBids() {
      const amountOfGas = await vcgContract.retreiveAllBids.estimateGas(
        '0x' + privateKeys[0],
        {
          from: auctioneer,
        }
      );
      console.log('gas estimation for retreiveAllBids is ' + amountOfGas);

      const revbids = await vcgContract.retreiveAllBids('0x' + privateKeys[0], {
        from: auctioneer,
      });
      console.log('decripted bids');
      console.log(revbids);

      let bidValues = [];
      for (let i = 0; i < bidders.length; i++) {
        bidValues.push(parseInt(revbids[i].slice(0, 2)));
      }
      console.log('bids ' + bidValues);
      return bidValues;
    }

    async function calculateWinnersAndPublishResults() {
      const amountOfGas = await vcgContract.closeAuction.estimateGas(
        bidValues,
        {
          from: auctioneer,
        }
      );

      console.log('gas estimation for close auction is ' + amountOfGas);

      const finalResult = await vcgContract.closeAuction(bidValues, {
        from: auctioneer,
      });
      const prices = finalResult.results.toString().split(',');
      const winners = finalResult.winnerIndexes
        .toString()
        .split(',')
        .slice(0, prices.length);

      const finapublishResultslResult = await vcgContract.publishResults(
        winners,
        prices,
        {from: auctioneer}
      );
      console.log(
        'publish results gas ' + finapublishResultslResult.receipt.gasUsed
      );
      return {winners, prices};
    }

    async function executePayemnt(i) {
      let payment = await vcgContract.payment({
        from: accounts[winners[i]],
        value: prices[i],
      });
      console.log('payment  gas ' + payment.receipt.gasUsed);
    }

    await openAuction();

    //bidding phase
    for (let i = 0; i < bidders.length; i++) {
      await bid(i);
    }

    await stopCommit();

    //encrypting bid
    for (let i = 0; i < bidders.length; i++) {
      await revealBid(i);
    }

    const bidValues = await getReveledBids();

    const {winners, prices} = await calculateWinnersAndPublishResults();

    for (let i = 0; i < prices.length; i++) {
      await executePayemnt(i);
    }
  });
});
