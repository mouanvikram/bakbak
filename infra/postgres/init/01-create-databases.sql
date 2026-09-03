-- Runs once, on first container init. POSTGRES_DB already created "bakbak_dev";
-- add the throwaway database the test suite truncates between cases.
CREATE DATABASE bakbak_test OWNER bakbak;
