#!/usr/bin/env python3

import sys
import praw
from collections import defaultdict
from flask import Flask, request, redirect, send_from_directory, jsonify, abort
from werkzeug.exceptions import NotFound
from authentication import read_or_create_device_index, RegisteredDevice
from votes import read_or_create_vote_index
from helpers import read_json
from scrape import scrape_cfc

if __name__ == "__main__":
    config = read_json(sys.argv[1])
    app = Flask(__name__, static_folder='../front-end/build')

    device_index = read_or_create_device_index('data/device-index.json')
    vote_index = read_or_create_vote_index('data/vote-index.json')

    def authenticate(req, require_admin=False) -> RegisteredDevice:
        device_id = req.args.get('deviceId')
        device = device_index.devices.get(device_id)
        if require_admin and device is not None and device.user_id not in device_index.admins:
            return None
        else:
            return device

    @app.route('/api/active-votes')
    def get_active_votes():
        """Gets all currently active votes."""
        device = authenticate(request)
        if not device:
            abort(403)

        return jsonify(vote_index.get_active_votes(device))

    @app.route('/api/all-votes')
    def get_all_votes():
        """Gets all votes."""
        return jsonify([vote['vote'] for vote in vote_index.votes.values()])

    @app.route('/api/vote')
    def get_vote():
        """Gets a specific vote."""
        device = authenticate(request)
        if not device:
            abort(403)

        return jsonify(vote_index.get_vote(request.args.get('voteId'), device))

    @app.route('/api/cast-ballot', methods=['POST'])
    def cast_ballot():
        """Receives a cast ballot."""
        device = authenticate(request)
        if not device:
            abort(403)

        ballot = request.json
        return jsonify(vote_index.cast_ballot(request.args.get('voteId'), ballot, device))

    @app.route('/api/admin/create-vote', methods=['POST'])
    def create_vote():
        """Creates a new vote."""
        device = authenticate(request, True)
        if not device:
            abort(403)

        proposal = request.json
        return jsonify(vote_index.create_vote(proposal))

    @app.route('/api/admin/cancel-vote', methods=['POST'])
    def cancel_vote():
        """Cancels a vote."""
        device = authenticate(request, True)
        if not device:
            abort(403)

        vote_id = request.args.get('voteId')
        return jsonify(vote_index.cancel_vote(vote_id))

    @app.route('/api/admin/scrape-cfc')
    def process_scrape_cfc():
        """Scrapes a Reddit CFC."""
        device = authenticate(request, True)
        if not device:
            abort(403)

        return jsonify(
            scrape_cfc(
                praw.Reddit(**config['bot-credentials']),
                request.args.get('url'),
                request.args.get('discernCandidates')))

    @app.route('/api/is-authenticated')
    def check_is_authenticated():
        device = authenticate(request)
        if not device:
            return jsonify('unauthenticated')
        elif device.user_id in device_index.admins:
            return jsonify('authenticated-admin')
        else:
            return jsonify('authenticated')

    @app.route('/api/user-id')
    def get_user_id():
        device = authenticate(request)
        return jsonify(device.user_id)

    @app.route('/reddit-auth')
    def process_auth():
        # Make sure that there's been no error.
        error = request.args.get('error')
        if error:
            return redirect(f'auth-failed?error={error}')

        # Check that the code is alright.
        code = request.args.get('code')
        if not code:
            return redirect(f'auth-failed?error=no-code')

        # Check that the state is alright.
        state = request.args.get('state')
        if not state:
            return redirect(f'auth-failed?error=no-state')
        elif ';' not in state:
            return redirect(f'auth-failed?error=malformed-state')

        device_id, return_url = state.split(';', maxsplit=2)

        # Log in with Reddit.
        reddit = praw.Reddit(**config['webapp-credentials'])
        reddit.auth.authorize(code)

        # Associate the device ID with the Redditor's username.
        device_index.register(device_id, reddit.user.me().name)

        # The user has been authenticated. Time to redirect.
        return redirect(return_url)

    @app.route('/<path:path>')
    def send_build(path):
        try:
            return send_from_directory('../front-end/build', path)
        except NotFound:
            return app.send_static_file('index.html')

    @app.route('/')
    def root():
        return app.send_static_file('index.html')

    app.run(debug=True)
