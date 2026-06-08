import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getTreasuryContract,
  getGovernanceDAOContract,
  getInstitutionRegistryContract,
  getPurchaseManagerContract,
} from "@/services/contractService";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";

const { MockContract } = vi.hoisted(() => {
  const MockContract = vi.fn();
  return { MockContract };
});

vi.mock("ethers", () => ({
  ethers: {
    Contract: MockContract,
  },
}));

describe("contractService", () => {
  const mockSigner = {};

  beforeEach(() => {
    MockContract.mockClear();
  });

  describe("getTreasuryContract", () => {
    it("instancia Contract com endereço Treasury correto", () => {
      getTreasuryContract(mockSigner as never);
      expect(MockContract).toHaveBeenCalledWith(
        CONTRACT_ADDRESSES.Treasury,
        expect.any(Array),
        mockSigner,
      );
    });
  });

  describe("getGovernanceDAOContract", () => {
    it("instancia Contract com endereço GovernanceDAO correto", () => {
      getGovernanceDAOContract(mockSigner as never);
      expect(MockContract).toHaveBeenCalledWith(
        CONTRACT_ADDRESSES.GovernanceDAO,
        expect.any(Array),
        mockSigner,
      );
    });
  });

  describe("getInstitutionRegistryContract", () => {
    it("instancia Contract com endereço InstitutionRegistry correto", () => {
      getInstitutionRegistryContract(mockSigner as never);
      expect(MockContract).toHaveBeenCalledWith(
        CONTRACT_ADDRESSES.InstitutionRegistry,
        expect.any(Array),
        mockSigner,
      );
    });
  });

  describe("getPurchaseManagerContract", () => {
    it("instancia Contract com endereço PurchaseManager correto", () => {
      getPurchaseManagerContract(mockSigner as never);
      expect(MockContract).toHaveBeenCalledWith(
        CONTRACT_ADDRESSES.PurchaseManager,
        expect.any(Array),
        mockSigner,
      );
    });
  });

  it("cada factory passa o signer recebido para o contrato", () => {
    const signer1 = { _isSigner: true };
    const signer2 = { _isProvider: true };

    getTreasuryContract(signer1 as never);
    expect(MockContract).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(Array),
      signer1,
    );

    getGovernanceDAOContract(signer2 as never);
    expect(MockContract).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(Array),
      signer2,
    );
  });
});
