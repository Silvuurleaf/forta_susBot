const {
  FindingType,
  FindingSeverity,
  Finding,
  createTransactionEvent,
  ethers,
} = require("forta-agent");
const {
  handleTransaction,
} = require("./agent");

describe("Suspicious Agent Reputation Alert", () => {
  describe("handleTransaction", () => {
    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.filterLog = jest.fn();

    beforeEach(() => {
      mockTxEvent.filterLog.mockReset();
    });

    it("Finding should be suspect score of 6 contract created", async () => {
      const mockContractCreationEvent = {
        args: {
          from: "0x50f9202e0f1c1577822bd67193960b213cd2f331",
          to: "0x0000000000000000000000000000000000000000",
          value: ethers.BigNumber.from(0),
        },
      };

      mockTxEvent.filterLog.mockReturnValue([mockContractCreationEvent]);

      const findings = await handleTransaction(mockTxEvent);

      let from_address = "0x50f9202e0f1c1577822bd67193960b213cd2f331";
      let prev_score = null;
      let curr_score = 6;
      let contractCreated = true;
      let changeInNonce = null;

      expect(findings).toStrictEqual([Finding.fromObject({
        name: "Suspicious account activity",
        description: 'Suspicious account activity from EOA',
        alertId: "HIGH-SUS",
        severity: FindingSeverity.Medium,
        type: FindingType.Suspicious,
        metadata: {
          "suspicious_EOA": from_address,
          "previous_suspicion_score": prev_score,
          "suspicion_score": curr_score,
          "contract_creation": contractCreated,
          "transaction_delta": changeInNonce,
        }
      })]);
    });
  });
});
