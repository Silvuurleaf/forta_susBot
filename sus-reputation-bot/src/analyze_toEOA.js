const { Finding, FindingSeverity, FindingType} = require("forta-agent");

const getEOA_profile = require('./fromAddressProfile.js');

async function analyze_toEOA(txEvent, cache, ethProvider) {

    const findings = [];
    let finding = null;

    let previous_suspicion_score;
    let current_total_suspicion = 0;
    let delta_suspicion = 0;

    let to_address = txEvent.to;
    let from_address = txEvent.from;
    let timestamp = txEvent.timestamp;


    let addresses = Object.keys(txEvent.addresses);

    let contractCreated = createsContract(to_address);

    //not examining contracts
    if (contractCreated)
        return findings;


    console.log("ALL ADDRESSES: " + addresses);
    console.log("recv Address: " + to_address);

    //create a profile object to describe EOA actions
    let eoa_object_to = await getEOA_profile.getEOA_profile(to_address, contractCreated);

    //if address is a contract we dont analyze it... For now
    if (eoa_object_to === null || undefined){
        return findings;
    }

    let old_eoa_info = null;

    if (cache.get(to_address) !== undefined) {

        //Account is already being monitored
        console.log("ADDRESS FOUND IN CACHE: " + to_address);

        old_eoa_info = cache.get(to_address); //get prev stored obj
        previous_suspicion_score = old_eoa_info.suspicion_score;


        //TODO need to change contract dev score as account gets older
        //account increase but can't decrease
        let contract_development_score = contract_dev_score(eoa_object_to);

        //ACCOUNTING FUND CHANGES
        let changeInBalance = old_eoa_info.balance - eoa_object_to.balance;
        eoa_object_to.changeInBalance = changeInBalance;
        let fund_delta = calc_funding_score(changeInBalance);

        let tx_activity_score = eval_short_term_activity(eoa_object_to, old_eoa_info, timestamp);
        current_total_suspicion = tx_activity_score+contract_development_score+fund_delta;

        console.log("SENDER")
        console.log("PREV SCORE: " + previous_suspicion_score)
        console.log("CURRENT SCORE: " + current_total_suspicion)

        if (previous_suspicion_score <= current_total_suspicion){
            eoa_object_to.suspicion_score = current_total_suspicion;
        }
        else{
            eoa_object_to.suspicion_score = previous_suspicion_score;
        }

        if(current_total_suspicion > previous_suspicion_score){
            delta_suspicion = current_total_suspicion - previous_suspicion_score;
        }

        console.log("suspicion score for address: " + from_address + " - Score: " + eoa_object_to.suspicion_score);
        cache.set(to_address, eoa_object_to);

    }
    else {
        //If this is a new address not in cache add it
        if(eoa_object_to.accountNonce <= 150){
            let eoa_suspicion_score =contract_dev_score(eoa_object_to);

            console.log("curr SCORE: " + eoa_suspicion_score)
            eoa_object_to.suspicion_score = eoa_suspicion_score;
            console.log("adding from address to monitor list");
            cache.set(to_address, eoa_object_to);
        }

    }

    if ( (delta_suspicion >= 6) && (previous_suspicion_score >= 5)) {
        finding = generate_HIGH_DELTA_finding(eoa_object_to, previous_suspicion_score, current_total_suspicion);
        findings.push(finding);
    }
    if(current_total_suspicion >= 9) {
        finding = generate_HIGH_SUS_finding(eoa_object_to, previous_suspicion_score, current_total_suspicion);
        findings.push(finding);
    }

    return findings;
}

function calc_funding_score(eoa_obj, changeInBalance){

    let suspicion_score = 0;
    //ACCOUNT FUNDING CHANGES
    //delta of funds between 1 and 2 eth, 2 and 5, and more than 5 eth
    if(changeInBalance >= 1000000000000000000 && changeInBalance <= 2000000000000000000)
        suspicion_score += 2;
    else if (changeInBalance > 2000000000000000000 && changeInBalance < 50000000000000000000)
        suspicion_score += 5;
    else if (changeInBalance >= 50000000000000000000)
        suspicion_score += 10;

    return suspicion_score;
}

function eval_short_term_activity(eoa_obj, old_eoa_obj, timestamp) {
    //How many transactions are performed within a 10 minute window
    let eoa_suspicion_score = 0;

    if (eoa_obj.transactionTime_interval !== null) {
        let timeDelta = eoa_obj.transactionTime_interval - timestamp;
        //600 seconds ~= 10 minutes
        //check for series of transactions in quick succession
        if (timeDelta >= 600) {
            let changeInNonce = old_eoa_obj.accountNonce - eoa_obj.accountNonce;
            //save the change in nonce to EOA obj
            eoa_obj.changeInNonce = changeInNonce;

            if (changeInNonce >= 5 && changeInNonce < 10)
                eoa_suspicion_score ++;
            if (changeInNonce >= 10)
                eoa_suspicion_score += 3;
        }
    }
    else{
        //if no previous transactions recorded update
        eoa_obj.transactionTime_interval = timestamp;
    }

    return eoa_suspicion_score;
}

function contract_dev_score(eoa_obj){

    let developer = eoa_obj.hasCreatedContracts;

    let eoa_suspicion_score = 0;

    //Heuristic combination of contract creation and a new account
    if(developer === true && eoa_obj.accountNonce >= 100)
        eoa_suspicion_score+= 1;
    else if (developer === true && ((eoa_obj.accountNonce >= 50) && (eoa_obj.accountNonce < 100)))
        eoa_suspicion_score += 3;
    else if (developer === true && eoa_obj.accountNonce < 50)
        eoa_suspicion_score += 6;

    return eoa_suspicion_score;
}
function createsContract(to_address) {
    if ((to_address === "0x0000000000000000000000000000000000000000") || (to_address=== null)) {
        //console.log("transaction created a smart contract")
        return true;
    }
}

function generate_HIGH_DELTA_finding(eoa_obj, prev_score, curr_score) {
    console.log("DELTA TOO HIGH")
    let from_address = eoa_obj.address;
    let changeInBalance = eoa_obj.changeInBalance;
    let changeInNonce = eoa_obj.changeInNonce;
    let contractCreated = eoa_obj.hasCreatedContracts;

    let description_msg = ("Highly suspicious change in account activity from EOA: " + from_address);

    //"balance_delta": changeInBalance, removed until draining flow can be made

    return Finding.fromObject({
        name: "Highly Suspicion Delta - EOA",
        description: description_msg,
        alertId: "HIGHLY-DELTA-EOA_ACTIVITY",
        severity: FindingSeverity.High,
        type: FindingType.Suspicious,
        metadata: {
            "suspicious_EOA": from_address,
            "previous_suspicion_score": prev_score,
            "suspicion_score": curr_score,
            "contract_creation": contractCreated,
            "transaction_delta": changeInNonce,
        },
    });
}

function generate_HIGH_SUS_finding(eoa_obj, prev_score, curr_score) {
    {
        let from_address = eoa_obj.address;
        let changeInBalance = eoa_obj.changeInBalance;
        let changeInNonce = eoa_obj.changeInNonce;
        let contractCreated = eoa_obj.hasCreatedContracts;

        let description_msg = ("Suspicious account activity from EOA: " + from_address);

        console.log("HIGH SUS")

        //"balance_delta": changeInBalance, removed until drain flow is added

        return Finding.fromObject({
            name: "Suspicious account activity",
            description: description_msg,
            alert_id: "SUSPICIOUS-EOA-ACTIVITY",
            severity: FindingSeverity.Medium,
            type: FindingType.Suspicious,
            metadata: {
                "suspicious_EOA": from_address,
                "previous_suspicion_score": prev_score,
                "suspicion_score": curr_score,
                "contract_creation": contractCreated,
                "transaction_delta": changeInNonce,
            },
        })
    }
}


module.exports = { analyze_toEOA };