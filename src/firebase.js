import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyABs140uFS80YbldMcIaRvbLl5ZpIDlSQo",
  authDomain: "project-9bb57415-7753-4429-a3b.firebaseapp.com",
  projectId: "project-9bb57415-7753-4429-a3b",
  storageBucket: "project-9bb57415-7753-4429-a3b.firebasestorage.app",
  messagingSenderId: "960201142506",
  appId: "1:960201142506:web:d6047a4ad75b00153ca793"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/**
 * Checks if a submission already exists for the given student name.
 * @param {string} studentName 
 * @returns {Promise<string|null>} - Returns the document ID if exists, or null.
 */
export async function checkExistingSubmission(studentName) {
  try {
    const q = query(collection(db, "submissions"), where("studentName", "==", studentName));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id;
    }
    return null;
  } catch (error) {
    console.error("Error checking existing submission: ", error);
    throw error;
  }
}

/**
 * Updates an existing student submission document in Firestore.
 * @param {string} docId 
 * @param {Object} data 
 * @returns {Promise<string>}
 */
export async function updateStudentData(docId, data) {
  try {
    const docRef = doc(db, "submissions", docId);
    await updateDoc(docRef, {
      ...data,
      submittedAt: serverTimestamp()
    });
    return docId;
  } catch (error) {
    console.error("Error updating document in Firestore: ", error);
    throw error;
  }
}

/**
 * Submits student evaluation data to Firestore.
 * @param {Object} data - The student submission data.
 * @returns {Promise<string>} - The document ID of the saved submission.
 */
export async function submitStudentData(data) {
  try {
    const docRef = await addDoc(collection(db, "submissions"), {
      ...data,
      submittedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding document to Firestore: ", error);
    throw error;
  }
}
