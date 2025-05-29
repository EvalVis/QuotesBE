# Quotes API

[![GitHub](https://img.shields.io/badge/GitHub-EvalVis/QuotesFE-black?style=flat&logo=github)](https://github.com/EvalVis/QuotesFE) - Check out the Frontend

## Functionality
Documented in endpoint /api-docs. You can view the docs in an already running backend app: https://quotesapi.fly.dev/api-docs/.

## Setup
This project uses Auth0 as authentication provider. To setup Auth0:
1. Create Auth0 account.
2. Follow the instructions to create and configure Single page application.
3. Follow the instructions to create and configure API. Allow use of refresh tokens if you want the frontend users to login less.
4. When user logs in, Auth0 JWT token will not have the username. Its mandatory for posting comments on the quotes. To make username available in JWT token:
   - In Auth0 webpage go to: Actions -> Triggers -> Post login.
   - Create a custom action:
   ```
   exports.onExecutePostLogin = async (event, api) => {
     const namespace = '[Your custom claim unique namespace]';

     if (event.user.nickname || event.user.name) {
       const fullName = `${event.user.given_name} ${event.user.family_name}`;
       api.accessToken.setCustomClaim(namespace + 'username', fullName);
    }
   };
   ```
   - Add the custom action to the Post Login flow.

This project uses MongoDB. You can setup it using MongoDB Atlas:
1. Create MongoDB Atlas account.
2. Create a database.
3. Setup IP whitelisting.
3. Copy the connection string and place it in environment variables of this backend.

### Environment variables
For project to run, several env variables are needed to be setup.

**`MONGODB_ATLAS_QUOTES_URL`**
Connection string of MongoDB Atlas for authentication with the database. **Caution**: this is a secret value, do not expose it.

**`jwt_jwksUri`**

Calling this URL provides public keys to verify JWT token signature.

Format: `https://[your Auth0 domain]/.well-known/jwks.json`.

**`jwt_audience`**

Value setup in your Auth0 API settings.

**`jwt_issuer`**

Your Auth0 domain.

**`jwt_customClaimsNamespace`**

Your custom namespace declared in custom action code of Auth0 Actions -> Triggers -> Post login.

**`db_name`**

Name of your MongoDB database.

**`db_quotesCollectionName`**

Name of the collection you will store quotes in.

**`db_usersCollectionName`**

Name of the collection you will store user saved quotes.

**`quotes_randomFetchSize`**

Determines how many quotes to fetch in main page.

Optional: default value is 5.

### Running locally
```
npm install
npm start
```

## Testing
To run the tests without execute:
```
npm test
```
To run tests with coverage:
```
npm run coverage
```

[![codecov](https://codecov.io/gh/EvalVis/QuotesBE/graph/badge.svg?token=OGRX2HFT69)](https://codecov.io/gh/EvalVis/QuotesBE)

## Resources
The quotes used in this API are from https://huggingface.co/datasets/Abirate/english_quotes.

## Quotes format
In database quotes are stored in this format:

_id: string, quote: string, author: string, tags: list of strings.

Example:

`{"quoteId": 2506, "quote": "Silence is so freaking loud", "author": "Sarah Dessen,", "tags": ["just-listen", "loud", "owen", "sara-dessen", "silence"]}`

## Hosting
One way to host is to use https://fly.io/:
1. Sign in to fly.io.
2. Setup fly cli.
3. Run `fly launch`. Dockerfile is generated. You can put env variables there. **Do not include** the secret value of MongoDB URL.
4. Execute `flyctl secrets set MONGODB_ATLAS_QUOTES_URL=Your_secret_mongodb_url`.
5. Execute `fly deploy`.

Already running BE service: https://quotesapi.fly.dev/api/quotes/random.

# Contributing

Please read a `CONTRIBUTING.md` file.

# License

Please read a `LICENSE` file.
