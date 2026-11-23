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



class ContractRouter {
    static createRouter(contractManager) {
        const router = express.Router();

        /**
         * GET /all
         * Returns all contracts in the system.
         */
        router.get("/all", async (req, res) => {
            try {
                const contracts = await contractManager.getContracts();
                res.json(contracts);

            } catch (error) {
                console.error("Error fetching contracts:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });


        /**
         * GET /:id
         * @param {string} id - The ID of the contract to retrieve.
         * Returns a specific contract by its ID.
         */
        router.get("/:id", validateRequest({
            params: { id: { type: "identifier" } },
        }), async (req, res) => {
            const contractId = req.params.id;

            try {
                const contract = await contractManager.getContractById(contractId);
                if(contract) {
                    res.json(contract);
                } else {
                    res.status(404).json({ error: "Contract not found" });
                }

                
            } catch (error) {
                console.error("Error fetching contract:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        })


        /**
         * POST /create
         * @body {Object} body - The contract data to create.
         * Creates a new contract with the provided data.
         */
        router.post("/create", validateRequest({
            body: {
                title: { type: "string", required: true, maxLength: 200 },
                content:  { type: "string", maxLength: 65535 },
                created_at: { type: "string", format: "date-time" }
            }
        }), async (req, res) => {
            try {
                const newContract = await contractManager.createContract({
                    ...req.body,
                    issuer: req.user.username
                });
                res.status(201).json(newContract);
                
            } catch (error) {
                console.error("Error creating contract:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        })



        /**
         * DELETE /:id
         * @param {string} id - The ID of the contract to delete.
         * Deletes a specific contract by its ID.
         */
        router.delete("/:id", validateRequest({
            params: { id: { type: "identifier" } },
        }), async (req, res) => {
            const contractId = req.params.id;

            try {
                const contract = await contractManager.getContractById(contractId);
                if (!contract) {
                    return res.status(404).json({ error: "Contract not found" });
                }

                if (contract.issuer !== req.user.username && req.user.role !== 'admin') {
                    return res.status(403).json({ error: "You are not authorized to delete this contract" });
                }

                const isDeleted = await contractManager.deleteContract(contractId);
                if (isDeleted) {
                    res.status(200).json({ message: "Contract deleted successfully" });
                } else {
                    res.status(404).json({ error: "Contract not found" });
                }
                
            } catch (error) {
                console.error("Error deleting contract:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });


        /**
         * GET /:id/signatures
         * @param {string} id - The ID of the contract to retrieve signatures for.
         * Returns all signatures for a specific contract by its ID.
         */
        router.get("/:id/signatures", validateRequest({
            params: { id: { type: "identifier" } },
        }), async (req, res) => {
            const contractId = req.params.id;

            try {
                const contract = await contractManager.getContractById(contractId);
                if (!contract) {
                    return res.status(404).json({ error: "Contract not found" });
                }
                
                // Check if the user is the issuer of the contract or an admin
                if(contract.issuer !== req.user.username && req.user.role !== 'admin') {
                    return res.status(403).json({ error: "You are not authorized to view signatures for this contract" });
                }

                const signatures = await contractManager.getContractSignaturesByContractId(contractId);
                res.json(signatures);
            } catch (error) {
                console.error("Error fetching contract signatures:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });


        /**
         * GET /:id/signatures/:signatureId
         * @param {string} id - The ID of the contract.
         * @param {string} signatureId - The ID of the signature to retrieve.
         * Returns a specific signature for a contract by its ID.
         */
        router.get("/:id/signatures/:signatureId", validateRequest({
            params: { 
                id: { type: "identifier" },
                signatureId: { type: "identifier" }
            },
        }), async (req, res) => {
            const contractId = req.params.id;
            const signatureId = req.params.signatureId;

            try {
                const contract = await contractManager.getContractById(contractId);
                if (!contract) {
                    return res.status(404).json({ error: "Contract not found" });
                }

                const signature = await contractManager.getContractSignatureById(signatureId);
                if (!signature || signature.contract_id !== contractId) {
                    return res.status(404).json({ error: "Signature not found for this contract" });
                }

                if(contract.issuer !== req.user.username && req.user.role !== 'admin' && signature.signer !== req.user.username) {
                    return res.status(403).json({ error: "You are not authorized to view this signature" });
                }

                res.json(signature);
            } catch (error) {
                console.error("Error fetching contract signature:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });


        /**
         * GET /signatures/:signer
         * @param {string} signer - The username of the signer to retrieve signatures for.
         * Returns all signatures for a specific signer.
         */
        router.get("/signatures/:signer", validateRequest({
            params: { signer: { type: "string" } },
        }), async (req, res) => {
            const signer = req.params.signer;

            try {
                if (signer !== req.user.username && req.user.role !== 'admin') {
                    return res.status(403).json({ error: "You are not authorized to view signatures for this signer" });
                }

                const signatures = await contractManager.getContractSignaturesBySigner(signer);
                res.json(signatures);
            } catch (error) {
                console.error("Error fetching contract signatures by signer:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });


        return router;
    }
}