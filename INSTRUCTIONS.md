# Project-T Instructions

**Note:** The project setup is currently incomplete. The React frontend and PostgreSQL database have not been created because the previous operation was cancelled.

## Current State

-   **Backend:** A NestJS application located in `apps/api`.

## How to Run the Backend

1.  **Install Dependencies:**
    Open your terminal at the root of the project and run:
    ```bash
    npm install
    ```

2.  **Run the API:**
    To start the NestJS backend in development mode, run:
    ```bash
    npm run dev -- --filter=api
    ```
    The API will be available at `http://localhost:3000`.

## Next Steps

To complete the project setup as originally planned, the following steps are needed:

1.  Create the React frontend application (`client`).
2.  Set up a PostgreSQL database using Docker.
3.  Configure the monorepo to run both applications concurrently.

Please let me know if you'd like me to proceed with these steps.
