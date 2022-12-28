const ctrs = require('./ctrs.js');
const VCG = artifacts.require('VCGCRTg');

contract('VCG Commit-Reveal', async (accounts) => {
  it('auction', async function () {
    const auctioneer = accounts[0];
    const bidders = [];
    for (let i = 0; i < accounts.length / 2; i++) {
      bidders.push(accounts[i + 1]);
    }

    //tables
    const bids = [];
    const passwords = [];
    
    //generating random bids and passwords
    for (let i = 0; i < bidders.length; i++) {
      let randomstring = Math.random().toString(36).slice(-8);
      passwords.push(randomstring);
      let bid = Math.floor(Math.random() * 100);
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
          from: bidders[i],
        }
      );

      console.log('gas estimation for calculateHash is ' + amountOfGas);

      let hashedData = await vcgContract.calculateHash(bids[i], passwords[i], {
        from: bidders[i],
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

    async function closeAuction() {
      let winners = [];
      let prices = [];

      const finalResult = await vcgContract.closeAuction({
        from: auctioneer,
      });
      console.log('close auction gas ' + finalResult.receipt.gasUsed);

      winners = finalResult.logs[0].args.agents;
      pricesInBNFormat = finalResult.logs[0].args.prices;

      for (let i = 0; i < pricesInBNFormat.length; i++) {
        prices.push(pricesInBNFormat[i].toNumber());
      }
      return {winners, prices};
    }

    async function executePayemnt(i) {
      let j = 0;
      while (winners[i] != bidders[j]) {
        j++;
      }
      let payment = await vcgContract.payment({
        from: bidders[j],
        value: prices[i],
      });
      console.log(bidders[j] + ' payed ' + prices[i]);
      console.log('payment gas ' + payment.receipt.gasUsed);
    }

    //Auction execution
    await openAuction();

    for (let i = 0; i < bidders.length; i++) {
      await bid(i);
    }

    await stopCommit();

    for (let i = 0; i < bidders.length; i++) {
      await revealBid(i);
    }

    const {winners, prices} = await closeAuction();

    for (let i = 0; i < prices.length; i++) {
      await executePayemnt(i);
    }
  });
});

