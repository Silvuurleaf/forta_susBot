const { Finding, FindingSeverity, FindingType, getEthersProvider} = require("forta-agent");

const getEOA_profile = require('./fromAddressProfile.js');

let cache = require('./memoryCache');

const ethProvider = getEthersProvider();

const analyze_fromEOA = require("./analyze_fromEOA.js");

const handleTransaction = async (txEvent) => {

    const findings = [];
    let finding = null;
    let description_msg = null;

    let to_address = txEvent.to;
    let from_address = txEvent.from;
    let timestamp = txEvent.timestamp;

    console.log("to address: " + to_address);
    console.log("from address: " + from_address);

    //analyze from

    let score = analyze_fromEOA.analyze_fromEOA(txEvent, cache);





    return findings;
};

const initialize = async () => {
   // do some initialization on startup e.g. fetch data
}

// const handleBlock = async (blockEvent) => {
//   const findings = [];
//   // detect some block condition
//   return findings;
// };

// const handleAlert = async (alertEvent) => {
//   const findings = [];
//   // detect some alert condition
//   return findings;
// };

module.exports = {
  // initialize,
  handleTransaction,

};
