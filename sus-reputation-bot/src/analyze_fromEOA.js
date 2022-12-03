const { Finding, FindingSeverity, FindingType} = require("forta-agent");


const getEOA_profile = require('./fromAddressProfile.js');

async function analyze_fromEOA(txEvent, cache, ethProvider)
{
    const findings = [];
    let finding = null;

    //reputation variables
    let previous_suspicion_score;
    let current_total_suspicion = 0;

    //change in suspicion between txns
    let delta_suspicion = 0;

    let to_address = txEvent.to;
    let from_address = txEvent.from;
    let timestamp = txEvent.timestamp;

    //check if txn creates a contract
    let contractCreated = createsContract(to_address);

    //console.log("Sender Address: " + from_address);
    //console.log("has created a contract: " + contractCreated);


    //create a profile object to describe EOA actions
    let eoa_object_from = await getEOA_profile.getEOA_profile(from_address, contractCreated, ethProvider);
    let old_eoa_info = null;

    //look into cache to see if TXN from address has a profile
    if (cache.get(from_address) !== undefined) {
        //Account is already being monitored

        //console.log("ADDRESS FOUND IN CACHE: " + from_address);

        //get prev stored obj
        old_eoa_info = cache.get(from_address);
        previous_suspicion_score = old_eoa_info.suspicion_score;


        //ACCOUNTING FUND CHANGES TODO add draining
        //let fund_delta = 0;

        //SHORT TERM ACTIVITY -- How many txn address performs within a timeframe
        let tx_activity_score = eval_short_term_activity(eoa_object_from, old_eoa_info, timestamp);

        //If the address developed a contract
        let contract_development_score = contract_dev_score(eoa_object_from);

        current_total_suspicion = tx_activity_score+contract_development_score+fund_delta;

        //console.log("PREV SCORE: " + previous_suspicion_score)
        //console.log("CURRENT SCORE: " + current_total_suspicion)

        //set account suspicion score to the highest
        if (previous_suspicion_score <= current_total_suspicion)
            eoa_object_from.suspicion_score = current_total_suspicion;
        else
            eoa_object_from.suspicion_score = previous_suspicion_score;

        if(current_total_suspicion > previous_suspicion_score)
            delta_suspicion = current_total_suspicion - previous_suspicion_score;

        //console.log("suspicion score for address: " + from_address + " - Score: " + eoa_object_from.suspicion_score);
        cache.set(from_address, eoa_object_from);
    }
    else {

        //console.log("---NEW EOA DETECTED---")
        //only monitoring new accounts

        //check how many txn account has been involved in
        if (eoa_object_from.accountNonce <= 200)
        {
            //check to see if it made a contract
            let contract_development_score = contract_dev_score(eoa_object_from);

            //console.log("current SCORE: " + contract_development_score);
            eoa_object_from.suspicion_score = contract_development_score;

            //console.log("adding from address to monitor list");
            cache.set(from_address, eoa_object_from);

        }
    }

    current_total_suspicion = eoa_object_from.suspicion_score;

    //if the suspicion score changed from +6 from the last recording emit an finding
    if ( (delta_suspicion >= 6) && (previous_suspicion_score >= 3)) {
        finding = generate_HIGH_DELTA_finding(eoa_object_from, previous_suspicion_score, current_total_suspicion);
        findings.push(finding);
    }

    //if total suspicion is +6 emit a finding
    if(current_total_suspicion >= 6) {
        finding = generate_HIGH_SUS_finding(eoa_object_from, previous_suspicion_score, current_total_suspicion);
        findings.push(finding);
    }

    return findings;
}

//helper fn checks if to_address is the zero address indicating contract creation
function createsContract(to_address) {
    if ((to_address === "0x0000000000000000000000000000000000000000") || (to_address=== null)) {
        console.log("transaction created a smart contract")
        return true;
    }
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

    //numbers choosen arbitrarily assumed a low nonce in combination with contract
    //development is suspicious. Lower the nonce -> more suspicious

    //Heuristic combination of contract creation and a new account
    if(developer === true && eoa_obj.accountNonce >= 100)
        eoa_suspicion_score+= 1;
    else if (developer === true && ((eoa_obj.accountNonce >= 50) && (eoa_obj.accountNonce < 100)))
        eoa_suspicion_score += 3;
    else if (developer === true && eoa_obj.accountNonce < 50)
        eoa_suspicion_score += 6;

    return eoa_suspicion_score;
}


function generate_HIGH_DELTA_finding(eoa_obj, prev_score, curr_score) {
    console.log("DELTA TOO HIGH")
    let from_address = eoa_obj.address;
    let changeInNonce = eoa_obj.changeInNonce;
    let contractCreated = eoa_obj.hasCreatedContracts;

    return Finding.fromObject({
        name: "Highly Suspicion Delta - EOA",
        description:'Suspicious change in account activity from EOA:' + from_address,
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
        let changeInNonce = eoa_obj.changeInNonce;
        let contractCreated = eoa_obj.hasCreatedContracts;

        return Finding.fromObject({
            name: "Suspicious account activity",
            description: 'Suspicious account activity from EOA',
            alertId: "Suspicious-Activity",
            severity: FindingSeverity.Medium,
            type: FindingType.Suspicious,
            metadata: {
                "suspicious_EOA": from_address,
                "previous_suspicion_score": prev_score,
                "suspicion_score": curr_score,
                "contract_creation": contractCreated,
                "transaction_delta": changeInNonce,
            }
        })
    }
}



module.exports = { analyze_fromEOA };