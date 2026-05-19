import React, { useEffect, useState } from "react";

function Profile() {
  const [profile, setProfile] = useState(null);
  const [bio, setBio] = useState("");
  const [file, setFile] = useState(null);

  const token = localStorage.getItem("access");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/profile/", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        setProfile(data);
        setBio(data.bio || "");
      });
  }, []);

  const handleUpdate = () => {
    const formData = new FormData();
    formData.append("bio", bio);

    if (file) {
      formData.append("profile_pic", file);
    }

    fetch("http://127.0.0.1:8000/api/profile/update/", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
      .then(res => res.json())
      .then(data => {
        setProfile(data);
        alert("Updated successfully");
      });
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div style={{ padding: "20px" }}>
      <h2>{profile.username}</h2>

      <img
        src={`http://127.0.0.1:8000${profile.profile_pic}`}
        alt=""
        width="120"
        style={{ borderRadius: "50%" }}
      />

      <br /><br />

      <input type="file" onChange={(e) => setFile(e.target.files[0])} />

      <br /><br />

      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Update bio"
        style={{ width: "300px", height: "80px" }}
      />

      <br /><br />

      <button onClick={handleUpdate}>Save</button>
    </div>
  );
}

export default Profile;