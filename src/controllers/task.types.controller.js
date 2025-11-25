import { pool } from "../db/connection.js"; // Ajusta según tu conexión

export const getTaskTypes = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM task_types ORDER BY id");
    res.json({ taskTypes: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener tipos de tareas" });
  }
};

export const getTaskTypeById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query("SELECT * FROM task_types WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ message: "Tipo de tarea no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener el tipo de tarea" });
  }
};

export const createTaskType = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "El nombre es requerido" });
  try {
    const [result] = await pool.query("INSERT INTO task_types (name) VALUES (?)", [name]);
    res.status(201).json({ id: result.insertId, name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear el tipo de tarea" });
  }
};

export const updateTaskType = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "El nombre es requerido" });
  try {
    const [result] = await pool.query("UPDATE task_types SET name = ? WHERE id = ?", [name, id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Tipo de tarea no encontrado" });
    res.json({ id, name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar el tipo de tarea" });
  }
};

export const deleteTaskType = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query("DELETE FROM task_types WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Tipo de tarea no encontrado" });
    res.json({ message: "Tipo de tarea eliminado" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar el tipo de tarea" });
  }
};
