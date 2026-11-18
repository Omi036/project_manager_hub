class Contract {
    constructor(contractManager, { id, title, content, issuer, created_at }) {
        this.contractManager = contractManager;
        this.id = id;
        this.title = title;
        this.content = content;
        this.issuer = issuer;
        this.created_at = created_at;
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            content: this.content,
            issuer: this.issuer,
            created_at: this.created_at,
        };
    }
}


class ContractSignature {
    constructor(contractManager, { id, contract_id, signer, created_at }) {
        this.contractManager = contractManager;
        this.id = id;
        this.contract_id = contract_id;
        this.signer = signer;
        this.created_at = created_at;
    }

    toJSON() {
        return {
            id: this.id,
            contract_id: this.contract_id,
            signer: this.signer,
            created_at: this.created_at,
        };
    }
}

class ContractManager {
    constructor(db) {
        this.db = db;
    }

    /** @returns {Promise<Contract[]>} All contracts */
    async getContracts() {
        const rows = await this.db.all(`SELECT * FROM contract ORDER BY created_at DESC`);
        return rows.map(row => new Contract(this, row));
    }

    /**
     * Gets a contract by its ID.
     * @param {string} contractId 
     * @returns {Promise<Contract | null>} The contract if found, otherwise null
     */
    async getContractById(contractId) {
        const [rows] = await this.db.get(`SELECT * FROM contract WHERE id = ?`, [contractId]);
        return rows.length > 0 ? new Contract(this, rows[0]) : null;
    }

    /**
     * Gets all contracts for a specific issuer.
     * @param {string} issuer Issuer username to filter contracts by.
     * @returns {Promise<Contract[]>} The contracts for the given issuer.
     */
    async getContractsByIssuer(issuer) {
        const rows = await this.db.all(`SELECT * FROM contract WHERE issuer = ? ORDER BY created_at DESC`, [issuer]);
        return rows.map(row => new Contract(this, row));
    }

    /**
     * Creates a new contract.
     * @param {Object} contractData The data for the new contract.
     * @returns {Promise<Contract>} The newly created contract.
     */
    async createContract(contractData) {
        const id = contractData.id || randomUUID();
        await this.db.run(
            `INSERT INTO contract (id, title, content, issuer)
             VALUES (?, ?, ?, ?)`,
            [id, contractData.title, contractData.content, contractData.issuer]
        );

        return this.getContractById(id);
    }

    /**
     * Updates a contract with the given ID using the provided data.
     * @param {string} contractId The ID of the contract to update.
     * @param {Object} contractData The data to update the contract with.
     * @returns {Promise<Contract | null>} The updated contract if found, otherwise null.
     */
    async updateContract(contractId, contractData) {
        const fields = {
            title: contractData.title,
            content: contractData.content,
            issuer: contractData.issuer,
        }

        const updates = Object.entries(fields).filter(([_, value]) => value !== undefined)
        const contract = await this.getContractById(contractId);
        if(!contract) return null;

        const connection = await this.db.getConnection();

        try {
            await connection.beginTransaction();
            if(updates.length > 0) {
                const setClause = updates.map(([key, _]) => `${key} = ?`).join(', ');
                const values = updates.map(([_, value]) => value);
                await connection.run(`UPDATE contract SET ${setClause} WHERE id = ?`, [...values, contractId]);
            }
            await connection.commit();
            return this.getContractById(contractId);

        } catch (error) {
            await connection.rollback();
            throw error;

        } finally {
            await connection.release();
        }
    }      

    /**
     * Deletes a contract with the given ID.
     * @param {string} contractId The ID of the contract to delete.
     * @returns {Promise<boolean>} True if the contract was deleted, false otherwise.
     */
    async deleteContract(contractId) {
        const [result] = await this.db.run(`DELETE FROM contract WHERE id = ?`, [contractId]);
        return result.affectedRows > 0;
    }


    /** @returns {Promise<ContractSignature[]>} All contract signatures */
    async getContractSignatures() {
        const rows = await this.db.all(`SELECT * FROM contract_signatures ORDER BY created_at DESC`);
        return rows.map(row => new ContractSignature(this, row));
    }
    
    /**
     * Gets a contract signature by its ID.
     * @param {string} signatureId The ID of the signature to find.
     * @returns {Promise<ContractSignature|null>} The signature if found, otherwise null.
     */
    async getContractSignatureById(signatureId) {
        const [rows] = await this.db.get(`SELECT * FROM contract_signatures WHERE id = ?`, [signatureId]);
        return rows.length > 0 ? new ContractSignature(this, rows[0]) : null;
    }
    
    /**
     * Gets all contract signatures for a specific contract.
     * @param {string} contractId The ID of the contract to find signatures for.
     * @returns {Promise<ContractSignature[]>} The signatures for the given contract.
     */
    async getContractSignaturesByContractId(contractId) {
        const rows = await this.db.all(`SELECT * FROM contract_signatures WHERE contract_id = ? ORDER BY created_at DESC`, [contractId]);
        return rows.map(row => new ContractSignature(this, row));
    }

    /**
     * Gets all contract signatures for a specific signer.
     * @param {string} signer The ID of the signer to find signatures for.
     * @returns {Promise<ContractSignature[]>} The signatures for the given signer.
     */
    async getContractSignaturesBySigner(signer) {
        const rows = await this.db.all(`SELECT * FROM contract_signatures WHERE signer = ? ORDER BY created_at DESC`, [signer]);
        return rows.map(row => new ContractSignature(this, row));
    }

    /**
     * Creates a new contract signature.
     * @param {Object} signatureData The data for the new signature.
     * @returns {Promise<ContractSignature>} The newly created signature.
     */
    async createContractSignature(signatureData) {
        const id = signatureData.id || randomUUID();
        await this.db.run(
            `INSERT INTO contract_signatures (id, contract_id, signer)
             VALUES (?, ?, ?)`,
            [id, signatureData.contract_id, signatureData.signer]
        );
        return this.getContractSignatureById(id);
    }

    /**
     * Deletes a contract signature with the given ID.
     * @param {string} signatureId The ID of the signature to delete.
     * @returns {Promise<boolean>} True if the signature was deleted, otherwise false.
     */
    async deleteContractSignature(signatureId) {
        const [result] = await this.db.run(`DELETE FROM contract_signatures WHERE id = ?`, [signatureId]);
        return result.affectedRows > 0;
    }
}