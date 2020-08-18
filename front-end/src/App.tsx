import React, { Suspense } from 'react';
import './App.css';
import { VoteAndBallots, Vote, Ballot } from './model/vote';
import { Route, BrowserRouter } from 'react-router-dom';
import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import { green } from '@material-ui/core/colors';
import VoteList from './components/vote-list';
import { Typography } from '@material-ui/core';
import { DummyAPIClient } from './model/dummy-api-client';
import VotePage from './components/vote-page';
import { FetchedStateComponent } from './components/fetched-state-component';
import VoteConfirmationPage from './components/vote-confirmation-page';
import { ServerAPIClient } from './model/server-api-client';
import MakeVotePage from './components/make-vote-page';
import MakeVoteConfirmationPage from './components/make-vote-confirmation-page';

let currentSeasons: string[] = [];

const theme = createMuiTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: green
  },
});

const apiClient = new ServerAPIClient();
const authenticator = apiClient.authenticator;

class App extends FetchedStateComponent<{}, boolean> {
  getMainClass(): string {
    return ["App", ...currentSeasons].join(" ");
  }

  fetchState(): Promise<boolean> {
    return authenticator.isAuthenticated();
  }

  renderState(isAuthenticated: boolean): JSX.Element {
    if (!isAuthenticated) {
      // If we aren't logged in yet, then we'll send the user to
      // an authentication page.
      return <div className={this.getMainClass()}>
        <header className="App-header">
          {authenticator.createAuthenticationPage()}
        </header>
      </div>;
    }

    return <BrowserRouter>
      <div className={this.getMainClass()}>
        <MuiThemeProvider theme={theme}>
          <header className="App-header">
            <Suspense fallback={<div>Loading...</div>}>
              <Route exact={true} path="/" component={VoteListRoute} />
              <Route path="/vote/:voteId" component={VoteRoute} />
              <Route path="/admin/make-vote" component={MakeVoteRoute} />
            </Suspense>
          </header>
        </MuiThemeProvider>
      </div>
    </BrowserRouter>;
  }
}

class VoteListRoute extends FetchedStateComponent<{ match: any }, VoteAndBallots[]> {
  fetchState(): Promise<VoteAndBallots[]> {
    return apiClient.getActiveVotes();
  }

  renderState(activeVotes: VoteAndBallots[]): JSX.Element {
    return <div>
      <Typography variant="h2">Active Votes</Typography>
      <VoteList votes={activeVotes} />
    </div>;
  }
}

type VoteRouteState = {
  vote?: VoteAndBallots;
  ballotCast?: boolean;
  ballotId?: string;
};

class VoteRoute extends FetchedStateComponent<{ match: any, history: any }, VoteRouteState> {
  async fetchState(): Promise<VoteRouteState> {
    let data = await apiClient.getVote(this.props.match.params.voteId);
    return { vote: data, ballotCast: false };
  }

  async onCastBallot(vote: Vote, ballot: Ballot) {
    this.setState({ hasConnected: true, data: { ...this.state.data, ballotCast: true } });
    let response = await apiClient.castBallot(vote.id, ballot);
    if ('error' in response) {
      this.setState({ hasConnected: true, error: response.error });
    } else {
      this.setState({ hasConnected: true, data: { ballotId: response.ballotId, ballotCast: true } });
    }
  }

  renderState(data: VoteRouteState): JSX.Element {
    if (!data.vote && !data.ballotCast) {
      return <div>
        <h1>Error 404</h1>
        Vote with ID '{this.props.match.params.voteId}' not found.
      </div>;
    }

    if (data.vote) {
      return <VotePage voteAndBallots={data.vote} ballotCast={data.ballotCast} onCastBallot={this.onCastBallot.bind(this)} />;
    } else {
      return <VoteConfirmationPage ballotId={data.ballotId!} />;
    }
  }
}

type MakeVoteRouteState = {
  voteSubmitted: boolean,
  createdVote?: Vote
};

class MakeVoteRoute extends FetchedStateComponent<{ history: any }, MakeVoteRouteState> {
  async fetchState(): Promise<MakeVoteRouteState> {
    return this.skipInitialStateFetch();
  }

  skipInitialStateFetch(): MakeVoteRouteState {
    return {
      voteSubmitted: false
    };
  }

  async onMakeVote(proposal: Vote) {
    this.setState({ ...this.state, data: { voteSubmitted: true } });
    try {
      let vote = await apiClient.admin.createVote(proposal);
      this.setState({ ...this.state, data: { voteSubmitted: true, createdVote: vote } });
    } catch (ex) {
      this.setState({ ...this.state, error: ex });
    }
  }

  renderState(data: MakeVoteRouteState): JSX.Element {
    if (data.createdVote) {
      return <MakeVoteConfirmationPage voteId={data.createdVote.id} />;
    } else {
      return <MakeVotePage hasSubmittedVote={data.voteSubmitted} onMakeVote={this.onMakeVote.bind(this)} />;
    }
  }
}

export default App;
