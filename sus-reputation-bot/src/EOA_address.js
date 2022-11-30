class eoa_address {
    constructor (address, balance, nonce) {
        this.address = address;
        this.balance = balance;
        this.accountNonce = nonce;

        this.transactionTime_interval = null;

        this.hasCreatedContracts = false;
        this.contractsCreated = [];
        this.contractsInteracted = [];

        this.suspicion_score = 0;

        this.changeInBalance = null;
        this.changeInNonce = null;
        this.changeInSuspicion = 0;
    }
}

module.exports = { eoa_address };