#!/usr/bin/env python3

"""Defines routines for creating votes by scraping a Reddit CFC."""

import sys
from praw import Reddit
from typing import Any, List, Union
from helpers import read_json


VoteOption = Any


def parse_cfc(body: str) -> Union[VoteOption, None]:
    """Parses a CFC."""
    split_body = body.strip().split('\n', maxsplit=1)
    if len(split_body) < 2:
        return None

    header, description = split_body
    candidate_name = header.strip().split()[0]
    candidate_id = candidate_name.lower().lstrip('/')
    if candidate_id.startswith('u/'):
        candidate_id = candidate_id[2:]

    return {
        'id': candidate_id,
        'name': header.strip(),
        'description': description.strip('\n')
    }


def scrape_cfc(reddit: Reddit, url: str) -> List[VoteOption]:
    """Scrapes a CFC from Reddit."""
    post = reddit.submission(url=url)
    results = []
    for top_level_comment in post.comments:
        if top_level_comment.author.name.lower() == 'automoderator':
            # Skip AutoModerator posts.
            continue

        option = parse_cfc(top_level_comment.body)
        if option is None:
            continue

        results.append(option)

    return results


if __name__ == "__main__":
    # This script is designed to be used by the server, but it can be used
    # directly to test scraping.
    credentials = read_json(sys.argv[1])['bot-credentials']
    print(
        scrape_cfc(
            Reddit(**credentials),
            'https://www.reddit.com/r/SimDemocracy/comments/i9qudc/39th_senatorial_vote_call_for_candidates/'))
