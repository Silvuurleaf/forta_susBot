const { Finding, FindingSeverity, FindingType, getEthersProvider} = require("forta-agent");

const getEOA_profile = require('./fromAddressProfile.js');

const ethProvider = getEthersProvider();


async function analyze_fromEOA(txEvent, cache)
{

    const findings = [];
    let finding = null;
    let description_msg = null;

    let previous_suspicion_score;
    let eoa_suspicion_score = 0;

    let to_address = txEvent.to;
    let from_address = txEvent.from;
    let timestamp = txEvent.timestamp;

    let contractCreated = createsContract(to_address);

    console.log("Sender Address: " + from_address);
    console.log("has created a contract: " + contractCreated);
    //create a profile object to describe EOA actions
    let eoa_object_from = await getEOA_profile.getEOA_profile(from_address, contractCreated);
    let old_eoa_info = null;
    let delta_suspicion = 0;


    if (cache.get(from_address) !== undefined) {
        //Account is already being monitored
        console.log("ADDRESS FOUND IN CACHE: " + from_address);

        old_eoa_info = cache.get(from_address); //get prev stored obj
        previous_suspicion_score = old_eoa_info.suspicion_score;


        //ACCOUNTING FUND CHANGES TODO add draining
        let fund_delta = 0;

        //SHORT TERM ACTIVITY
        let tx_activity_score = eval_short_term_activity(eoa_object_from, old_eoa_info, timestamp);
        let contract_development_score = contract_dev_score(eoa_object_from);
        let current_total_suspicion = tx_activity_score+contract_development_score+fund_delta;

        console.log("PREV SCORE: " + previous_suspicion_score)
        console.log("CURRENT SCORE: " + current_total_suspicion)

        if (previous_suspicion_score <= current_total_suspicion){
            eoa_object_from.suspicion_score = current_total_suspicion;
        }
        else{
            eoa_object_from.suspicion_score = previous_suspicion_score;
        }

        if(current_total_suspicion > previous_suspicion_score){
            delta_suspicion = current_total_suspicion - previous_suspicion_score;
        }

        console.log("suspicion score for address: " + from_address + " - Score: " + eoa_object_from.suspicion_score);
        cache.set(from_address, eoa_object_from);
    }
    else {

        //only monitoring new accounts
        if (eoa_object_from.accountNonce <= 200)
        {
            let contract_development_score = contract_dev_score(eoa_object_from);

            console.log("current SCORE: " + contract_development_score);
            eoa_object_from.suspicion_score = contract_development_score;
            console.log("adding from address to monitor list");
            cache.set(from_address, eoa_object_from);
        }

    }


    if ( (delta_suspicion >= 6) && (previous_suspicion_score >= 5)) {
    }

    if(eoa_suspicionScore >= 9)
    {

        console.log("HIGH SUS")

        description_msg = ("Suspicious account activity from EOA: " + from_address);

        finding = Finding.fromObject({
            name: "Suspicious account activity",
            description: description_msg,
            alert_id: "SUSPICIOUS-EOA-ACTIVITY",
            severity: FindingSeverity.Medium,
            type: FindingType.Suspicious,
            metadata: {
                "suspicious_EOA": from_address,
                "previous_suspicion_score": previous_suspicion_score,
                "suspicion_score": eoa_suspicionScore,
                "balance_delta": changeInBalance,
                "contract_creation": contractCreated,
                "transaction_delta": changeInNonce,
            },
        })

        findings.push(finding);
    }
}

function createsContract(to_address) {
    if ((to_address === "0x0000000000000000000000000000000000000000") || (to=== null)) {
        //console.log("transaction created a smart contract")
        return  true;
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

    //Heuristic combination of contract creation and a new account
    if(developer === true && eoa_obj.accountNonce >= 100)
        eoa_suspicion_score+= 1;
    else if (developer === true && ((eoa_obj.accountNonce >= 50) && (eoa_obj.accountNonce < 100)))
        eoa_suspicion_score += 3;
    else if (developer === true && eoa_obj.accountNonce < 50)
        eoa_suspicion_score += 6;

    return eoa_suspicion_score;
}

function generate_HIGH_SUS_finding(eoa_obj, prev_score, curr_score) {
    console.log("DELTA TOO HIGH")
    let from_address = eoa_obj.address;
    let changeInBalance = eoa_obj.changeInBalance;
    //let contractCreated = eoa_obj.

    let description_msg = ("Highly suspicious account activity from EOA: " + from_address);

    let finding = Finding.fromObject({
        name: "Highly suspicious EOA",
        description: description_msg,
        alertId: "HIGHLY-SUSPICIOUS-EOA_ACTIVITY",
        severity: FindingSeverity.High,
        type: FindingType.Suspicious,
        metadata: {
            "suspicious_EOA": from_address,
            "previous_suspicion_score": prev_score,
            "suspicion_score": curr_score,
            "balance_delta": changeInBalance,
            "contract_creation": contractCreated,
            "transaction_delta": changeInNonce,
        },
    })
    findings.push(finding);
}

module.exports = { analyze_fromEOA };