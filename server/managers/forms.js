const express = require("express");
const { validateJsonBody, validateRequest } = require("../validation");


class Form {
    constructor(formManager, { id, title, description, anonymous, max_responses, created_at, created_by }) {
        this.formsManager = formManager;
        this.id = id;
        this.title = title;
        this.description = description;
        this.anonymous = anonymous;
        this.max_responses = max_responses;
        this.created_at = created_at;
        this.created_by = created_by;
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            anonymous: this.anonymous,
            max_responses: this.max_responses,
            created_at: this.created_at,
            created_by: this.created_by,
        };
    }
}


class FormQuestion {
    constructor(formManager, { id, form_id, position, question, type, options, required }) {
        this.formsManager = formManager;

        this.id = id;
        this.form_id = form_id;
        this.position = position;
        this.question = question;
        this.type = type;
        this.options = options;
        this.required = required;
    }

    toJSON() {
        return {
            id: this.id,
            form_id: this.form_id,
            position: this.position,
            question: this.question,
            type: this.type,
            options: this.options,
            required: this.required,
        };
    }

    async delete() {
        return this.formsManager.deleteFormQuestion(this.id);
    }
}

class FormResponse {
    constructor(formManager, { id, form_id, responder, response, created_at }) {
        this.formsManager = formManager;
        this.id = id;
        this.form_id = form_id;
        this.responder = responder;
        this.response = response;
        this.created_at = created_at;
    }

    toJSON() {
        return {
            id: this.id,
            form_id: this.form_id,
            responder: this.responder,
            response: this.response,
            created_at: this.created_at,
        };
    }

    async delete() {
        return this.formsManager.deleteFormResponse(this.id);
    }
}


class FormManager {
    constructor(db) {
        this.db = db;
    }


    /** @returns {Promise<Form[]>} All forms in the database, ordered by creation date (newest first). */
    async getForms() {
        const rows = await this.db.all(`SELECT * FROM forms ORDER BY created_at DESC`);
        return rows.map(row => new Form(this, row));
    }

    /**
     * Gets a form by its ID.
     * @param {string} id The ID of the form to find.
     * @returns {Promise<Form|null>} The form if found, otherwise null.
     */
    async getFormById(formId) {
        const [rows] = await this.db.get(`SELECT * FROM forms WHERE id = ?`, [formId]);
        return rows.length ? new Form(this, rows[0]) : null;
    }

    /**
     * Creates  form.
     * @param {Object} formData Form data to insert.
     * @returns {Promise<Form>} The newly created form.
     */
    async createForm(formData) {
        const id = formData.id || Date.now();
        await this.db.run(`
            INSERT INTO forms (id, title, description, anonymous, max_responses, created_by) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, formData.title, formData.description, formData.anonymous, formData.max_responses, formData.created_by]);
        return this.getFormById(id);
    }
    
    /**
     * Updates a form with the given ID using the provided data.
     * @param {string} formId Form ID to update.
     * @param {*} formData Fields to update.
     */
    async updateForm(formId, formData) {
        const fields = {
            title: formData.title,
            description: formData.description,
            anonymous: formData.anonymous,
            max_responses: formData.max_responses,
        }

        const updates = Object.entries(fields).filter(([_, value]) => value !== undefined)
        const form = await this.getFormById(formId);
        if (!form) return null;

        const connection = await this.db.getConnection();

        try {
            await connection.beginTransaction();
            if (updates.length > 0) {
                const setClause = updates.map(([key]) => `${key} = ?`).join(", ");
                const values = updates.map(([_, value]) => value);
                await connection.run(`UPDATE forms SET ${setClause} WHERE id = ?`, [...values, formId]);
            }
            await connection.commit();
            return this.getFormById(formId);

        } catch (error) {
            await connection.rollback();
            throw error;

        } finally {
            connection.release();
        }
    }

    /**
     * Deletes a form with the given ID.
     * @param {string} formId Form ID to delete.
     */
    async deleteForm(formId) {
        const [result] = await this.db.run("DELETE FROM forms WHERE id = ?", [formId]);
        return result.affectedRows > 0; // Returns true if a row was deleted, false otherwise
    }




    /**
     * Retrieves all questions for a specific form, ordered by creation date (oldest first).
     * @param {string} formId 
     * @returns {Promise<FormQuestion[]>} All questions for the given form, ordered by creation date (oldest first).
     */
    async getFormQuestions(formId) {
        const rows = await this.db.all("SELECT * FROM form_questions WHERE form_id = ? ORDER BY created_at ASC", [formId]);
        return rows.map(row => new FormQuestion(this, row));
    }

    /**
     * Retrieves a specific question by its ID.
     * @param {string} questionId
     * @returns {Promise<FormQuestion|null>} The question if found, otherwise null.
     */
    async getFormQuestionById(questionId) {
        const [rows] = await this.db.get("SELECT * FROM form_questions WHERE id = ?", [questionId]);
        return rows.length ? new FormQuestion(this, rows[0]) : null;
    }

    /**
     * Creates a new question for a specific form.
     * @param {string} formId The ID of the form to which the question belongs.
     * @param {Object} questionData The data for the new question.
     */
    async createFormQuestion(formId, questionData) {
        const id = questionData.id || Date.now();
        await this.db.run(`
            INSERT INTO form_questions (id, form_id, position, question, type, options, required) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [id, formId, questionData.position, questionData.question, questionData.type, JSON.stringify(questionData.options), questionData.required]);
        return this.getFormQuestionById(id);
    }

    /**
     * Updates a specific question by its ID.
     * @param {string} questionId The ID of the question to update.
     * @param {Object} questionData The data to update the question with.
     * @returns {Promise<FormQuestion|null>} The updated question if found, otherwise null.
     */
    async updateFormQuestion(questionId, questionData) {
        await this.db.run(`
            UPDATE form_questions
            SET position = ?, question = ?, type = ?, options = ?, required = ?
            WHERE id = ?
        `, [questionData.position, questionData.question, questionData.type, JSON.stringify(questionData.options), questionData.required, questionId]);
        return this.getFormQuestionById(questionId);
    }

    /**
     * Deletes a specific question by its ID.
     * @param {string} questionId The ID of the question to delete.
     * @returns {Promise<boolean>} True if the question was deleted, false otherwise.
     */
    async deleteFormQuestion(questionId) {
        const [result] = await this.db.run("DELETE FROM form_questions WHERE id = ?", [questionId]);
        return result.affectedRows > 0; // Returns true if a row was deleted, false otherwise
    }


    

    /**
     * Retrieves all responses for a specific form, ordered by creation date (newest first).
     * @param {string} formId The id of the form to look in
     * @returns 
     */
    async getFormResponses(formId) {
        const rows = await this.db.all("SELECT * FROM forms_responses WHERE form_id = ? ORDER BY created_at DESC", [formId]);
        return rows.map(row => new FormResponse(this, row));
    }

    /**
     * Retrieves a specific form response by its ID.
     * @param {string} responseId The ID of the response to retrieve.
     * @returns {Promise<FormResponse|null>} The form response if found, otherwise null.
     */
    async getFormResponseById(responseId) {
        const [rows] = await this.db.get("SELECT * FROM forms_responses WHERE id = ?", [responseId]);
        return rows.length ? new FormResponse(this, rows[0]) : null;
    }

    /**
     * Creates a new response for a specific form.
     * @param {string} formId The ID of the form to which the response belongs.
     * @param {Object} responseData The data for the new response.
     * @returns {Promise<FormResponse|null>} The new form response if created, otherwise null.
     */
    async createFormResponse(formId, responseData) {
        const id = responseData.id || Date.now();
        await this.db.run(`
            INSERT INTO forms_responses (id, form_id, responder, response) 
            VALUES (?, ?, ?, ?)
        `, [id, formId, responseData.responder, JSON.stringify(responseData.response)]);
        return this.getFormResponseById(id);
    }

    /**
     * Deletes a specific form response by its ID.
     * @param {string} responseId The ID of the response to delete.
     * @returns {Promise<boolean>} True if the response was deleted, false otherwise.
     */
    async deleteFormResponse(responseId) {
        const [result] = await this.db.run("DELETE FROM forms_responses WHERE id = ?", [responseId]);
        return result.affectedRows > 0; // Returns true if a row was deleted, false otherwise
    }

    /**
     * Gets all responses for a specific form submitted by a specific responder, ordered by creation date (newest first).
     * @param {string} formId The if of the form to look in
     * @param {string} responder The username of the responder to look for
     * @returns {Promise<FormResponse[]>} All responses for the given form and responder, ordered by creation date (newest first).
     */
    async getFormResponsesByResponder(formId, responder) {
        const rows = await this.db.all("SELECT * FROM forms_responses WHERE form_id = ? AND responder = ? ORDER BY created_at DESC", [formId, responder]);
        return rows.map(row => new FormResponse(this, row));
    }
}