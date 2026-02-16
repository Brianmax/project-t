# Project-T Instructions

The initial setup of the monorepo is complete, and the core features of the Property Management System have been implemented. Here are the instructions to get you started and test the functionalities.

## Project Structure

-   `apps/api`: A NestJS application for your backend.
-   `apps/client`: A React (Vite) application for your frontend.
-   `docker-compose.yml`: Defines the PostgreSQL database service.
-   `packages/*`: Shared configurations for the monorepo.

## Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or higher)
-   [npm](https://www.npmjs.com/)
-   [Docker](https://www.docker.com/) (for running the database)

## Getting Started

1.  **Install Dependencies:**
    If you haven't already, install all the project dependencies from the root directory:
    ```bash
    npm install
    ```

2.  **Start the Database:**
    Open a new terminal window at the project root and run the following command to start the PostgreSQL database using Docker:
    ```bash
    docker-compose up
    ```
    The database will be running and accessible on port `5432`.

3.  **Run Development Servers:**
    Open another terminal window at the project root and execute the following command to start both the backend (`api`) and frontend (`client`) in development mode:
    ```bash
    npm run dev
    ```
    -   The **React frontend** will be available at `http://localhost:5173`.
    -   The **NestJS backend** will be available at `http://localhost:3000`.

## Implemented Features & How to Test

Navigate to `http://localhost:5173` in your browser. You will see sections for:

### 1. Property Management
-   **Add New Property:** Use the form to add properties by entering a `Name` and `Address`.
-   **View Properties:** Added properties will appear in the "Properties" list below the form.

### 2. Department Management
-   **Add New Department:** Use the form. Select an existing `Property` from the dropdown, then enter `Name`, `Floor`, and `Number of Rooms`.
-   **View Departments:** Added departments will appear in the "Departments" list, showing their associated property.

### 3. Tenant Management
-   **Add New Tenant:** Use the form to add tenants by entering `Name`, `Email`, and optionally `Phone`.
-   **View Tenants:** Added tenants will appear in the "Tenants" list.

### 4. Contract Management
-   **Add New Contract:** Use the form. Select an existing `Tenant` and `Department`. Provide `Start Date`, `End Date`, `Rent Amount`, `Advance Payment`, and `Guarantee Deposit`.
-   **View Contracts:** Added contracts will appear in the "Contracts" list, showing associated tenant and department details.

### 5. Meter Management (Department Meters)
-   **Add New Department Meter:** Use the form. Select an existing `Department` and `Meter Type` (Light/Water).
-   **View Department Meters:** Added meters will appear in the "Department Meters" list.

### 6. Meter Management (Property Meters)
-   **Add New Property Meter:** Use the form. Select an existing `Property` and `Meter Type` (Light/Water).
-   **View Property Meters:** Added meters will appear in the "Property Meters" list.

### 7. Meter Reading Management
-   **Add New Meter Reading:** Use the form. Select an existing `Department Meter`. Provide `Reading Value` and `Date`.
-   **View Meter Readings:** Added readings will appear in the "Meter Readings" list.

### 8. Payment Management
-   **Add New Payment:** Use the form. Select an existing `Contract`. Provide `Amount`, `Date`, optional `Description`, and `Payment Type`.
-   **View Payments:** Added payments will appear in the "Payments" list.

### 9. Receipt Generation
-   In the "Contracts" section, for a given contract, you can use the "Generate Receipt" sub-section.
-   Select the contract, specify the `Month` and `Year`, and click "Generate Receipt".
-   A structured receipt (JSON output) will be displayed, including rent, utility costs (if meter readings are present for the period), and payments.

### 10. Contract Finalization
-   In the "Contracts" section, for a given contract, you can use the "Calculate Final Settlement" sub-section.
-   Select the contract, provide an `Actual End Date`, and click "Calculate Settlement".
-   A structured settlement result (JSON output) will be displayed, showing total charges, total payments, guarantee deduction, and final balance.

## Other Useful Commands

-   **Build for Production:**
    To build both applications for production, run from the project root:
    ```bash
    npm run build
    ```

-   **Linting:**
    To check for code quality issues across the entire monorepo, run from the project root:
    ```bash
    npm run lint
    ```

-   **Formatting:**
    To automatically format all the code, run from the project root:
    ```bash
    npm run format
    ```

## Conventional Commits

This project enforces [Conventional Commits](https://www.conventionalcommits.org/). Every time you commit, your message will be automatically checked.
Example of a valid commit message:
`feat: allow users to change their password`
`fix: correct a typo in the login button`
