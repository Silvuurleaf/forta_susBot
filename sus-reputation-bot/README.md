# Suspicion/Reputation Forta Bot

## Description

This agent monitors EOA's with a nonce of 200<

The bot looks at the following traits to determine suspicion.

Nonce: How much or little they interact with the blockchain. 
Provides an age estimate for the account.

Nonce Delta: The change in number of transactions over a 
10-minute window. If the account suddenly has an uptick in number
of txn its suspicion score increases.

Nonce + Contract Creation: If the EOA creates a contract by sending
a txn to the zero address its score will increase. The increase
is arbitrarily chosen based on the nonce. The assumption is a bad
actor will spin up a burner address and deploy their contract immediately and
begin exploitation. 

Things not implemented
- changes in account balances are not used as a heuristic but should be
- contract interactions aren't monitored (i.e interaction w/ blacklist isn't supported)
- Analysis is performed only based on the from addresses in a txn

## Supported Chains

- Ethereum


## Alerts

HIGHLY-DELTA-EOA_ACTIVITY 
- fired when there is a change in the baseline suspicion of a monitored EOA
- Things that can trigger the alert are contract creation and rapid fire transactions

Suspicious-Activity 
- Fired when an account reaches a suspicion score of 6 or an EOA with a score of 6 or higher performs a txn.
- Alert fired for new accounts, contract creation + new accounts, or high amounts of txns


OOF
- bot currently has a bunch of issues and doesn't work as desired.
- Need to add way to record contract interactions
- Need to add method to record change in balances when interacting w/ smart contracts
- Need to add blacklist interactions
