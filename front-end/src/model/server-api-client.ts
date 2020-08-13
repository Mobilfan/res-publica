import { Authenticator } from "./auth";
import { VoteAndBallots, Ballot, Vote } from "./vote";
import { APIClient } from "./api-client";
import { RedditAuthenticator } from "./reddit-auth";

/**
 * A client implementation that communicates with the server's API.
 */
export class ServerAPIClient implements APIClient {
    constructor() {
        this.auth = new RedditAuthenticator();
    }

    /**
     * Gets an authenticator appropriate for this API client.
     */
    get authenticator(): Authenticator {
        return this.auth;
    }

    /**
     * Gets all currently active votes.
     */
    async getActiveVotes(): Promise<VoteAndBallots[]> {
        let response = await fetch(`/api/active-votes?deviceId=${encodeURIComponent(this.auth.deviceId)}`);
        return await response.json();
    }

    /**
     * Gets a list of all votes so far.
     */
    async getAllVotes(): Promise<Vote[]> {
        let response = await fetch("/api/all-votes");
        return await response.json();
    }

    /**
     * Gets a specific vote.
     */
    async getVote(id: string): Promise<VoteAndBallots | undefined> {
        let response = await fetch(`/api/vote?voteId=${encodeURIComponent(id)}&deviceId=${encodeURIComponent(this.auth.deviceId)}`);
        return await response.json();
    }

    /**
     * Casts a ballot for an active vote. If the ballot was
     * submitted successfully, a unique identifier for the ballot
     * is returned that can be used to verify that the ballot was
     * indeed well received.
     */
    async castBallot(voteId: string, ballot: Ballot): Promise<{ ballotId: string } | { error: string }> {
        let response = await fetch(
            `/api/cast-ballot?voteId=${encodeURIComponent(voteId)}&deviceId=${encodeURIComponent(this.auth.deviceId)}`,
            {
                method: "POST",
                body: JSON.stringify(ballot),
                headers: {'Content-Type': 'application/json; charset=UTF-8'}
            });
        return await response.json();
    }

    private auth: RedditAuthenticator;
}