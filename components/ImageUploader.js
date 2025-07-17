import { useState, useEffect } from "react";
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from "firebase/storage";
import { storage, db } from "../utils/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

export default function ImageUploader() {
  const [file, setFile] = useState(null);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Carregar imagens salvas no Firestore
  useEffect(() => {
    async function fetchImages() {
      const snapshot = await getDocs(collection(db, "images"));
      setImages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    fetchImages();
  }, [uploading]);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    // Salva URL no Firestore
    await addDoc(collection(db, "images"), { url });
    setFile(null);
    setUploading(false);
  }

  async function handleDelete(image) {
    setUploading(true);
    // Excluir do Storage
    const storageRef = ref(storage, image.url);
    try { await deleteObject(storageRef); } catch (e) {}
    // Excluir do Firestore
    await deleteDoc(doc(db, "images", image.id));
    setUploading(false);
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h3>Imagens do Carrossel</h3>
      <input
        type="file"
        accept="image/*"
        onChange={e => setFile(e.target.files[0])}
        disabled={uploading}
      />
      <button onClick={handleUpload} disabled={!file || uploading} style={{ marginLeft: 10 }}>
        {uploading ? "Enviando..." : "Enviar imagem"}
      </button>
      <div style={{ display: "flex", flexWrap: "wrap", marginTop: 24 }}>
        {images.map(img => (
          <div key={img.id} style={{ marginRight: 16, marginBottom: 16, position: "relative" }}>
            <img src={img.url} alt="" style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd" }} />
            <button
              onClick={() => handleDelete(img)}
              style={{
                position: "absolute", top: 0, right: 0, background: "#d32f2f", color: "#fff", border: "none", borderRadius: "0 8px 0 8px", padding: "2px 6px", cursor: "pointer"
              }}
            >
              X
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
