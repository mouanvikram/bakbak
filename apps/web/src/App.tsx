import { BrowserRouter, Routes, Route } from "react-router";
import { LoginPage } from "./features/auth/components/LoginPage";
import { SignupPage } from "./features/auth/components/SingupPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<p>This is home Page</p>}/>
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="/signup" element={<SignupPage/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
