var SmartDHX = require('./SmartDHX');
const ctrs = require('./ctrs.js');

const MultipartySmartDiffieHellmanController = artifacts.require(
  'MultipartySmartDiffieHellmanController'
);
const MultipartySmartDiffieHellmanClient = artifacts.require(
  'MultipartySmartDiffieHellmanClient'
);
const VCG = artifacts.require('VCGMixer');

contract('VCG with Diffie–Hellman Mixer test', async (accounts) => {
  it('auction', async function () {
    const auctioneer = accounts[0];
    const bidders = [];
    for (let i = 0; i < 5; i++) {
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
      let newAddress = accounts[i + 4];
      amountOfGas = await vcgContract.encryptAddress.estimateGas(
        newAddress,
        '0x' + privateKeys[i]
      );

      console.log('gas estimation for encryptAddress is ' + amountOfGas);

      let encryptedAddress = await vcgContract.encryptAddress(
        newAddress,
        '0x' + privateKeys[i]
      );
      let result = await vcgContract.encryptedBidding(
        encryptedbid,
        encryptedAddress,
        {from: accounts[i]}
      );
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
      let amountOfGas = await vcgContract.retreiveAllBids.estimateGas(
        '0x' + privateKeys[0],
        {
          from: auctioneer,
        }
      );
      console.log('gas estimation for retreiveAllBids is ' + amountOfGas);
      const revbids = await vcgContract.retreiveAllBids('0x' + privateKeys[0], {
        from: auctioneer,
      });
      console.log('decripted bids ' + revbids);

      amountOfGas = await vcgContract.retreiveAllAddresses.estimateGas(
        '0x' + privateKeys[0],
        {
          from: auctioneer,
        }
      );
      console.log('gas estimation for retreiveAllAddresses is ' + amountOfGas);
      const revAddresses = await vcgContract.retreiveAllAddresses(
        '0x' + privateKeys[0],
        {from: auctioneer}
      );
      console.log('decripted addresses ' + revAddresses);

      let bidValues = [];
      for (let i = 0; i < bidders.length; i++) {
        let text = revbids[i].slice(0, 4);
        bidValues.push(parseInt(text.replace(/\0/g, '')));
      }
      console.log('bids ' + bidValues);
      return {bidValues, revAddresses};
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
      const winnerIndexes = finalResult.winnerIndexes
        .toString()
        .split(',')
        .slice(0, prices.length);

      const winnerAddresses = [];
      for (let i = 0; i < winnerIndexes.length; i++) {
        winnerAddresses.push(revAddresses[i]);
      }

      const finapublishResultslResult = await vcgContract.publishResults(
        winnerAddresses,
        prices,
        {from: auctioneer}
      );
      console.log(
        'publish results gas ' + finapublishResultslResult.receipt.gasUsed
      );
      console.log(winnerAddresses);
      console.log(prices);
      return {winnerAddresses, prices};
    }

    async function executePayemnt(i) {
      let j = 0;
      while (winnerAddresses[i] != accounts[j]) {
        j++;
      }
      let payment = await vcgContract.payment({
        from: accounts[j],
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

    const {bidValues, revAddresses} = await getReveledBids();

    const {winnerAddresses, prices} = await calculateWinnersAndPublishResults();

    for (let i = 0; i < prices.length; i++) {
      await executePayemnt(i);
    }
  });
});
