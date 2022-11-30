const { Finding, FindingSeverity, FindingType, getEthersProvider, keccak256, ethers} = require("forta-agent");
const Web3 = require("web3");

const eoa = require('./EOA_address.js');
const helper = require('./helper')
const rlp = require("rlp");


const ethProvider = getEthersProvider();

async function getEOA_profile(address, createdContract) {

    //figure out if it's an EOA or contract
    let code = await ethProvider.getCode(String(address));

    console.log("the code is: " + code);

    if ("0x" === code) {
        //if an EOA build a profile

        let balance = await ethProvider.getBalance(address);
        let account_nonce = await ethProvider.getTransactionCount(address);

        const addressProfile = new eoa.eoa_address(address, balance, account_nonce)

        if (createdContract){
            addressProfile.hasCreatedContracts = true;
            addressProfile.contractsCreated.push(contract_creation_address(address, account_nonce));
        }

        return addressProfile;

    } else {
        console.log("is a contract");
        return null;
    }

}


function contract_creation_address(address, nonce)
{
    console.log("calculating address");
    console.log(address)

    //let address_bytes = Web3.utils.hexToBytes(address);
    //let contract_address = Web3.utils.toChecksumAddress(keccak256(rlp.encode([address_bytes, nonce])).slice(-20));

    //let anticipated_address = ethers.utils.getContractAddress({address, nonce});

    const anticipatedAddress = ethers.utils.getContractAddress({
        from: address,
        nonce,
    });

    console.log("calculated contract addresss: " + anticipatedAddress)
    return anticipatedAddress;
}


module.exports = { getEOA_profile };