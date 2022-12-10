const ctrs = require('./ctrs.js');

const VCG = artifacts.require('VCGCR');

contract('VCG Commit-Reveal test', async (accounts) => {
  it('auction', async function () {
    const auctioneer = accounts[0];
    const bidders = [];
    for (let i = 0; i < accounts.length; i++) {
      bidders.push(accounts[i]);
    }

    //tables
    const bids = [];
    const passwords = [];

    //generating random bids and passwords
    for (let i = 0; i < accounts.length / 2; i++) {
      let randomstring = Math.random().toString(36).slice(-8);
      passwords.push(randomstring);
      let bid = Math.floor(Math.random() * 100 + 1);
      bids.push(bid);
    }
    console.log('printing bids and passwords');
    console.log(bids);
    console.log(passwords);

    //deploying contract
    const vcgContract = await VCG.new();
    let receipt = await web3.eth.getTransactionReceipt(
      vcgContract.transactionHash
    );
    console.log('gas used for deployment ' + receipt.gasUsed.toString());

    //Functions
    async function bid(i) {
      let amountOfGas = await vcgContract.calculateHash.estimateGas(
        bids[i],
        passwords[i],
        {
          from: accounts[i],
        }
      );

      console.log('gas estimation for calculateHash is ' + amountOfGas);

      let hashedData = await vcgContract.calculateHash(bids[i], passwords[i], {
        from: accounts[i],
      });

      let bidTx = await vcgContract.bid(hashedData, {from: bidders[i]});
      console.log('bid ' + i + ' gas ' + bidTx.receipt.gasUsed);
    }

    async function revealBid(i) {
      const revealTx = await vcgContract.revealBid(bids[i], passwords[i], {
        from: bidders[i],
      });
      console.log('reveal ' + i + ' gas ' + revealTx.receipt.gasUsed);
    }

    async function openAuction() {
      const openAuctionTx = await vcgContract.openAuction(ctrs.ctrs, {
        from: auctioneer,
      });
      console.log('open auction gas ' + openAuctionTx.receipt.gasUsed);
    }

    async function stopCommit() {
      const stopCommitTx = await vcgContract.stopCommitPhase({
        from: auctioneer,
      });
      console.log('stop commit gas ' + stopCommitTx.receipt.gasUsed);
    }

    async function getReveledBids() {
      const reveledBids = [];
      for (let i = 0; i < accounts.length / 2; i++) {
        let amountOfGas = await vcgContract.bids.estimateGas(i);
        console.log('gas estimation for reading bids is ' + amountOfGas);
        5;

        let bidsFromContract = await vcgContract.bids(i);
        reveledBids.push(bidsFromContract);
      }
      return reveledBids;
    }

    async function calculateWinnersAndPublishResults() {
      let winners = [];
      let prices = [];

      const amountOfGas = await vcgContract.closeAuction.estimateGas(
        reveledBids,
        {
          from: auctioneer,
        }
      );

      console.log('gas estimation for close auction is ' + amountOfGas);

      const finalResult = await vcgContract.closeAuction(reveledBids, {
        from: auctioneer,
      });

      prices = finalResult.results.toString().split(',');
      winners = finalResult.winnerIndexes
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
        from: bidders[winners[i]],
        value: prices[i],
      });
      console.log('payment  gas ' + payment.receipt.gasUsed);
    }

    //Auction execution
    await openAuction();

    for (let i = 0; i < accounts.length / 2; i++) {
      await bid(i);
    }

    await stopCommit();

    for (let i = 0; i < accounts.length / 2; i++) {
      await revealBid(i);
    }

    const reveledBids = await getReveledBids();

    const {winners, prices} = await calculateWinnersAndPublishResults();

    for (let i = 0; i < prices.length; i++) {
      await executePayemnt(i);
    }
  });
});
