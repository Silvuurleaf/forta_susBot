const {getEthersProvider} = require("forta-agent");

let cache = require('./memoryCache');

const analyze_fromEOA = require("./analyze_fromEOA.js");

//const ethProvider = new Web3.providers.HttpProvider(getJsonRpcUrl());

const ethProvider = getEthersProvider()

const handleTransaction = async (txEvent) => {

    const findings = [];

    let from_findings = await analyze_fromEOA.analyze_fromEOA(txEvent, cache, ethProvider);

    for (let i = 0; i < from_findings.length; i++) {
        findings.push(from_findings[i]);
    }

    return findings;
};


module.exports = {
  handleTransaction,

};
