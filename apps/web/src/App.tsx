import { BrowserRouter, Routes, Route } from "react-router";
import { LoginPage } from "./features/auth/components/LoginPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<p>This is home Page</p>}/>
        <Route path="/login" element={<LoginPage/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
