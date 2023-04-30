import React, { useState, useEffect } from 'react';

import Menu from './components/Menu';
import Header from './components/Header';
import Home from './pages/Home';
import View from './pages/View';
import Footer from './components/Footer';
import AddCamera from './pages/AddCamera';
import Cameralist from './pages/CameraList';
import Onvif from './pages/Onvif';
import Login from './pages/Login';
import Register from './pages/Register';

import {BrowserRouter, Routes, Route, redirect} from "react-router-dom";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [Userdata, SetUserdata] = useState([]);
  useEffect(() => {
    fetchLogined();
  },[isLoggedIn]);

  async function fetchLogined() {
    const response = await fetch('/user/');
    const json = await response.json();
    console.log(json);
    setIsLoggedIn(json.islogined)
    SetUserdata(json.user);
  }
  
  const handleLogin = (login) => {
    console.log(login);
    setIsLoggedIn(login);
  };


  return (
    <>
    <BrowserRouter>
      {isLoggedIn && <Header user={Userdata} handleLogin={handleLogin} /> }
      {isLoggedIn && <Menu/> }
      {isLoggedIn && <Routes>
        <Route exact path="/" element={<Home />}/>
        <Route exact path="/View" element={<View />}/>
        <Route exact path="/camera" element={<Cameralist />}/>
        <Route exact path="/camera/add" element={<AddCamera user={Userdata}/>}/>
        <Route exact path="/onvif" element={<Onvif user={Userdata}/>}/>
    </Routes>
     }
      {isLoggedIn && <Footer />}
      {!isLoggedIn && <Routes>
      <Route exact path="/" element={<Login handleLogin={handleLogin}/>}/>
      <Route exact path="/user/register" element={<Register/>}/>
      </Routes>
      }
      </BrowserRouter>
    </>
  );
}

export default App;