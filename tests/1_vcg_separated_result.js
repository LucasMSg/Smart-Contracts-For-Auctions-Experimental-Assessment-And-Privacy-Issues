const ctrs = require('./ctrs.js');

const VCG = artifacts.require('VCGSep');

contract('VCG separated results test', async (accounts) => {
  it('auction', async function () {
    const auctioneer = accounts[0];
    const bidders = [];
    for (let i = 0; i < accounts.length / 2; i++) {
      bidders.push(accounts[i]);
    }

    //table
    const bids = [];

    //generating random bids
    for (let i = 0; i < accounts.length / 2; i++) {
      let bid = Math.floor(Math.random() * 100 + 1);
      bids.push(bid);
    }
    console.log('printing bids');
    console.log(bids);

    //deploying contract
    const vcgContract = await VCG.new();
    let receipt = await web3.eth.getTransactionReceipt(
      vcgContract.transactionHash
    );
    console.log('gas used for deployment ' + receipt.gasUsed.toString());

    //Functions
    async function bid(i) {
      let bidTx = await vcgContract.bid(bids[i], {from: bidders[i]});
      console.log('bid ' + i + ' gas ' + bidTx.receipt.gasUsed);
    }

    async function openAuction() {
      const openAuctionTx = await vcgContract.openAuction(ctrs.ctrs, {
        from: auctioneer,
      });
      console.log('open auction gas ' + openAuctionTx.receipt.gasUsed);
    }

    async function calculateWinnersAndPublishResults() {
      let winners = [];
      let prices = [];

      const amountOfGas = await vcgContract.closeAuction.estimateGas({
        from: auctioneer,
      });

      console.log('gas estimation for closeAuction ' + amountOfGas);

      const finalResult = await vcgContract.closeAuction({
        from: auctioneer,
      });

      prices = finalResult.results.toString().split(',');
      IndexesInBNFormat = finalResult.winnerIndexes;

      for (let i = 0; i < prices.length; i++) {
        winners.push(IndexesInBNFormat[i].toNumber());
      }

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

    for (let i = 0; i < accounts.length / 2; i++) {
      await bid(i);
    }

    const {winners, prices} = await calculateWinnersAndPublishResults();

    for (let i = 0; i < prices.length; i++) {
      await executePayemnt(i);
    }
  });
});
